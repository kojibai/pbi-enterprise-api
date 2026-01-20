import type { CanonicalAction } from "../pbi/canonical.js";
import { actionHashHex } from "../pbi/canonical.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type PbiClientConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  userAgent?: string;
};

export type ChallengeRequest = {
  purpose?: string;
  kind?: string;
  actionHashHex: string;
  ttlSeconds?: number;
};

export type ChallengeResponse = {
  id: string;
  challengeB64Url: string;
  expiresAtIso: string;
  purpose: string;
  actionHashHex: string;
  challenge?: Record<string, unknown>;
  metering?: Record<string, string>;
};

export type VerifyRequest = {
  challengeId: string;
  assertion: {
    authenticatorDataB64Url: string;
    clientDataJSONB64Url: string;
    signatureB64Url: string;
    credIdB64Url: string;
    pubKeyPem: string;
  };
};

export type VerifyResponse = {
  ok: boolean;
  decision: string;
  receiptId?: string;
  receiptHashHex?: string;
  receipt?: Record<string, unknown>;
  reason?: string;
};

export type ReceiptResponse = {
  receipt: Record<string, unknown>;
  challenge?: Record<string, unknown> | null;
};

export type ReceiptListResponse = {
  receipts: Array<Record<string, unknown>>;
  nextCursor: string | null;
};

export type ReceiptVerifyRequest = {
  receiptId: string;
  receiptHashHex: string;
};

export type ReceiptVerifyResponse = {
  ok: boolean;
  receipt?: Record<string, unknown>;
  challenge?: Record<string, unknown> | null;
  reason?: string;
};

export type ReceiptExportResponse = Uint8Array;

export type ReceiptListQuery = {
  limit?: number;
  cursor?: string;
  createdAfter?: string;
  createdBefore?: string;
  order?: "asc" | "desc";
  actionHashHex?: string;
  challengeId?: string;
  purpose?: string;
  decision?: "PBI_VERIFIED" | "FAILED" | "EXPIRED" | "REPLAYED";
};

export type ReceiptIntent = {
  purpose: CanonicalAction["purpose"];
  payload: CanonicalAction["payload"];
  ttlSeconds?: number;
};

export class PbiReceiptsClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: FetchLike;
  private userAgent?: string;

  constructor(config: PbiClientConfig) {
    if (!config.apiKey) {
      throw new Error("PbiReceiptsClient requires apiKey");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.kojib.com").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.userAgent = config.userAgent;
  }

  createActionHash(intent: ReceiptIntent): string {
    return actionHashHex({ purpose: intent.purpose, payload: intent.payload });
  }

  async createReceiptIntent(intent: ReceiptIntent): Promise<ChallengeResponse> {
    const actionHashHex = this.createActionHash(intent);
    return this.createChallenge({
      purpose: intent.purpose,
      actionHashHex,
      ttlSeconds: intent.ttlSeconds
    });
  }

  async createChallenge(body: ChallengeRequest): Promise<ChallengeResponse> {
    return this.requestJson("/v1/pbi/challenge", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async verifyChallenge(body: VerifyRequest): Promise<VerifyResponse> {
    return this.requestJson("/v1/pbi/verify", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async getReceipt(receiptId: string): Promise<ReceiptResponse> {
    return this.requestJson(`/v1/pbi/receipts/${encodeURIComponent(receiptId)}`);
  }

  async getReceiptForChallenge(challengeId: string): Promise<ReceiptResponse> {
    return this.requestJson(`/v1/pbi/challenges/${encodeURIComponent(challengeId)}/receipt`);
  }

  async listReceipts(query: ReceiptListQuery = {}): Promise<ReceiptListResponse> {
    const qs = toQueryString(query);
    return this.requestJson(`/v1/pbi/receipts${qs}`);
  }

  async verifyReceipt(body: ReceiptVerifyRequest): Promise<ReceiptVerifyResponse> {
    return this.requestJson("/v1/pbi/receipts/verify", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async exportReceipts(query: ReceiptListQuery & { limit: number }): Promise<ReceiptExportResponse> {
    const qs = toQueryString(query);
    return this.requestBinary(`/v1/pbi/receipts/export${qs}`);
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("Accept", "application/json");
    if (this.userAgent) headers.set("User-Agent", this.userAgent);
    if (init.body) headers.set("Content-Type", "application/json");

    const resp = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await resp.text();
    const payload = text ? (JSON.parse(text) as T) : ({} as T);

    if (!resp.ok) {
      const error = new Error(`PBI request failed (${resp.status})`);
      Object.assign(error, { status: resp.status, payload });
      throw error;
    }

    return payload;
  }

  private async requestBinary(path: string, init: RequestInit = {}): Promise<Uint8Array> {
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (this.userAgent) headers.set("User-Agent", this.userAgent);

    const resp = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const buffer = new Uint8Array(await resp.arrayBuffer());

    if (!resp.ok) {
      const error = new Error(`PBI request failed (${resp.status})`);
      Object.assign(error, { status: resp.status, payload: buffer });
      throw error;
    }

    return buffer;
  }
}

function toQueryString(query: Record<string, string | number | undefined>): string {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return "";
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}
