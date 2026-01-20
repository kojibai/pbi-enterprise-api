import { PresenceBoundError, isErrorResponse, parseJson } from "./errors.js";
import type {
  ApiResponse,
  ChallengeRequest,
  ChallengeResponse,
  ReceiptExportParams,
  ReceiptListParams,
  ReceiptListResponse,
  ReceiptResponse,
  ReceiptVerifyRequest,
  ReceiptVerifyResponse,
  ReceiptWithChallenge,
  UsageResponse,
  InvoicesResponse,
  VerifyRequest,
  VerifyResponse
} from "./types.js";

export type { PresenceBoundError } from "./errors.js";
export * from "./types.js";

export interface PresenceBoundOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
}

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  accept?: string;
}

export class PresenceBound {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly userAgent?: string;

  constructor(options: PresenceBoundOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.kojib.com";
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.userAgent = options.userAgent;
  }

  async createChallenge(request: ChallengeRequest): Promise<ApiResponse<ChallengeResponse>> {
    return this.requestJson<ChallengeResponse>({
      method: "POST",
      path: "/v1/pbi/challenge",
      body: request
    });
  }

  async verifyChallenge(request: VerifyRequest): Promise<ApiResponse<VerifyResponse>> {
    return this.requestJson<VerifyResponse>({
      method: "POST",
      path: "/v1/pbi/verify",
      body: request
    });
  }

  async listReceipts(params: ReceiptListParams = {}): Promise<ApiResponse<ReceiptListResponse>> {
    return this.requestJson<ReceiptListResponse>({
      method: "GET",
      path: "/v1/pbi/receipts",
      query: this.serializeParams(params)
    });
  }

  async *iterateReceipts(params: ReceiptListParams = {}): AsyncGenerator<ReceiptWithChallenge, void, void> {
    let cursor = params.cursor;
    while (true) {
      const response = await this.listReceipts({ ...params, cursor });
      for (const receipt of response.data.receipts) {
        yield receipt;
      }
      const nextCursor = response.data.nextCursor ?? undefined;
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }
  }

  async getReceipt(receiptId: string): Promise<ApiResponse<ReceiptResponse>> {
    return this.requestJson<ReceiptResponse>({
      method: "GET",
      path: `/v1/pbi/receipts/${encodeURIComponent(receiptId)}`
    });
  }

  async verifyReceipt(request: ReceiptVerifyRequest): Promise<ApiResponse<ReceiptVerifyResponse>> {
    return this.requestJson<ReceiptVerifyResponse>({
      method: "POST",
      path: "/v1/pbi/receipts/verify",
      body: request
    });
  }

  async exportReceipts(params: ReceiptExportParams): Promise<ApiResponse<Uint8Array>> {
    return this.requestBinary({
      method: "GET",
      path: "/v1/pbi/receipts/export",
      query: this.serializeParams(params),
      accept: "application/zip"
    });
  }

  async getUsage(month?: string): Promise<ApiResponse<UsageResponse>> {
    return this.requestJson<UsageResponse>({
      method: "GET",
      path: "/v1/billing/usage",
      query: month ? { month } : undefined
    });
  }

  async listInvoices(): Promise<ApiResponse<InvoicesResponse>> {
    return this.requestJson<InvoicesResponse>({
      method: "GET",
      path: "/v1/billing/invoices"
    });
  }

  private async requestJson<T>(options: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request(options);
    const requestId = this.getRequestId(response);
    const payload = await parseJson(response);

    if (!response.ok) {
      const details = isErrorResponse(payload) ? payload : undefined;
      const message = details?.error ?? `Request failed with status ${response.status}`;
      throw new PresenceBoundError(message, { status: response.status, requestId, details });
    }

    return {
      data: payload as T,
      requestId
    };
  }

  private async requestBinary(options: RequestOptions): Promise<ApiResponse<Uint8Array>> {
    const response = await this.request(options);
    const requestId = this.getRequestId(response);

    if (!response.ok) {
      const payload = await parseJson(response);
      const details = isErrorResponse(payload) ? payload : undefined;
      const message = details?.error ?? `Request failed with status ${response.status}`;
      throw new PresenceBoundError(message, { status: response.status, requestId, details });
    }

    const buffer = await response.arrayBuffer();
    return {
      data: new Uint8Array(buffer),
      requestId
    };
  }

  private async request(options: RequestOptions): Promise<Response> {
    const url = new URL(options.path, this.baseUrl);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers({
      Authorization: `Bearer ${this.apiKey}`,
      Accept: options.accept ?? "application/json"
    });
    if (this.userAgent) {
      headers.set("User-Agent", this.userAgent);
    }
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url.toString(), {
        method: options.method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PresenceBoundError(`Request timed out after ${this.timeoutMs}ms`, {
          status: 408
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private serializeParams(params: Record<string, string | number | undefined>): Record<string, string | number> {
    const entries = Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value as string | number]);
    return Object.fromEntries(entries);
  }

  private getRequestId(response: Response): string | undefined {
    return response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
  }
}
