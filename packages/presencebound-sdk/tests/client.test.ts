import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PresenceBound } from "../src/index.js";
import type { ReceiptListResponse } from "../src/types.js";

const createResponse = (body: unknown, init: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });

describe("PresenceBound", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("sends auth and user agent headers", async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: true, decision: "PBI_VERIFIED" }, {
        status: 200,
        headers: { "x-request-id": "req-123" }
      })
    );

    const client = new PresenceBound({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
      userAgent: "presencebound-sdk/0.1.0"
    });

    const response = await client.verifyChallenge({
      challengeId: "challenge-id",
      assertion: {
        authenticatorDataB64Url: "a",
        clientDataJSONB64Url: "b",
        signatureB64Url: "c",
        credIdB64Url: "d",
        pubKeyPem: "e"
      }
    });

    expect(response.requestId).toBe("req-123");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.example.com/v1/pbi/verify");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(headers.get("User-Agent")).toBe("presencebound-sdk/0.1.0");
  });

  it("iterates receipts with pagination helper", async () => {
    const firstPage: ReceiptListResponse = {
      receipts: [
        {
          receipt: {
            id: "r1",
            challengeId: "c1",
            receiptHashHex: "hash",
            decision: "PBI_VERIFIED",
            createdAt: "2024-01-01T00:00:00Z"
          }
        }
      ],
      nextCursor: "next"
    };
    const secondPage: ReceiptListResponse = {
      receipts: [
        {
          receipt: {
            id: "r2",
            challengeId: "c2",
            receiptHashHex: "hash",
            decision: "PBI_VERIFIED",
            createdAt: "2024-01-02T00:00:00Z"
          }
        }
      ],
      nextCursor: null
    };

    fetchMock
      .mockResolvedValueOnce(createResponse(firstPage, { status: 200 }))
      .mockResolvedValueOnce(createResponse(secondPage, { status: 200 }));

    const client = new PresenceBound({ apiKey: "test-key", baseUrl: "https://api.example.com" });

    const receipts: string[] = [];
    for await (const receipt of client.iterateReceipts({ limit: 1 })) {
      receipts.push(receipt.receipt.id);
    }

    expect(receipts).toEqual(["r1", "r2"]);
  });

  it("throws typed errors with requestId", async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({ error: "Invalid request" }, {
        status: 400,
        headers: { "request-id": "req-err" }
      })
    );

    const client = new PresenceBound({ apiKey: "test-key", baseUrl: "https://api.example.com" });

    await expect(
      client.createChallenge({ actionHashHex: "00".repeat(32) })
    ).rejects.toMatchObject({
      name: "PresenceBoundError",
      status: 400,
      requestId: "req-err"
    });
  });
});
