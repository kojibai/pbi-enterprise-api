export type Base64UrlString = string;
export type HexString = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [k: string]: JsonValue };

export type PBIActionV1 = Readonly<{
  ver: "pbi-action-1.0";
  aud: string;
  purpose: string;
  method: string;
  path: string;
  query: string;
  params: JsonObject;
}>;

export type PBIReceiptV1 = Readonly<{
  ver: "pbi-receipt-1.0";
  challengeId: string;
  challenge: Base64UrlString;
  actionHash: HexString;
  aud: string;
  purpose: string;
  authorSig: Readonly<{
    alg: "webauthn-es256";
    credId: Base64UrlString;
    authenticatorData: Base64UrlString;
    clientDataJSON: Base64UrlString;
    signature: Base64UrlString;
  }>;
}>;

export type VectorCase = Readonly<{
  name: string;
  desc: string;
  rpId: string;
  origin: string;
  action: PBIActionV1;
  receipt: PBIReceiptV1;
  pubKeyJwk: JsonWebKey;
  expect: Readonly<
    | { result: "ok" }
    | { result: "error"; code: string }
  >;
}>;

export type VectorFile = Readonly<{
  ver: "pbi-conf-1.0";
  spec: "pbi-spec-1.0";
  createdAt: string;
  cases: readonly VectorCase[];
}>;

export type ExternalVerifierInput = Readonly<{
  rpId: string;
  origin: string;
  action: PBIActionV1;
  receipt: PBIReceiptV1;
  pubKeyJwk: JsonWebKey;
}>;

export type ExternalVerifierOutput =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: string; detail?: string }>;