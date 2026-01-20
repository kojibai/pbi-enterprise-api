import type { ErrorResponse } from "./types.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null;

export const isErrorResponse = (value: unknown): value is ErrorResponse => {
  if (!isRecord(value)) return false;
  return typeof value.error === "string";
};

export class PresenceBoundError extends Error {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly details: ErrorResponse | undefined;

  constructor(
    message: string,
    options: {
      status: number;
      requestId?: string | undefined;
      details?: ErrorResponse | undefined;
    }
  ) {
    super(message);
    this.name = "PresenceBoundError";
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
};
