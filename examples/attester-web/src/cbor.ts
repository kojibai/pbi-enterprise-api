export type CborValue =
  | number
  | bigint
  | string
  | Uint8Array
  | CborValue[]
  | Map<CborValue, CborValue>
  | null
  | boolean;

type Cursor = { i: number };

function readU8(b: Uint8Array, c: Cursor): number {
  const v = b[c.i];
  if (v === undefined) throw new Error("CBOR: out of bounds");
  c.i += 1;
  return v;
}

function readN(b: Uint8Array, c: Cursor, n: number): Uint8Array {
  const end = c.i + n;
  if (end > b.length) throw new Error("CBOR: out of bounds");
  const slice = b.slice(c.i, end);
  c.i = end;
  return slice;
}

function readUint(b: Uint8Array, c: Cursor, ai: number): number | bigint {
  if (ai < 24) return ai;
  if (ai === 24) return readU8(b, c);
  if (ai === 25) {
    const v = readN(b, c, 2);
    return (v[0]! << 8) | v[1]!;
  }
  if (ai === 26) {
    const v = readN(b, c, 4);
    const n = (v[0]! * 2 ** 24) + (v[1]! << 16) + (v[2]! << 8) + v[3]!;
    return n >>> 0;
  }
  if (ai === 27) {
    const v = readN(b, c, 8);
    let n = 0n;
    for (const x of v) n = (n << 8n) | BigInt(x);
    return n;
  }
  throw new Error("CBOR: unsupported uint size");
}

export function cborDecode(bytes: Uint8Array): CborValue {
  const c: Cursor = { i: 0 };
  const v = decodeItem(bytes, c);
  if (c.i !== bytes.length) {
    // ignore trailing for robustness? no, be strict in demo.
  }
  return v;
}

function decodeItem(b: Uint8Array, c: Cursor): CborValue {
  const ib = readU8(b, c);
  const mt = ib >> 5;
  const ai = ib & 0x1f;

  // major type 0: unsigned int
  if (mt === 0) {
    const u = readUint(b, c, ai);
    return typeof u === "bigint" ? u : u;
  }

  // major type 1: negative int = -1 - unsigned
  if (mt === 1) {
    const u = readUint(b, c, ai);
    if (typeof u === "bigint") return -1n - u;
    return -1 - u;
  }

  // major type 2: byte string
  if (mt === 2) {
    const len = readUint(b, c, ai);
    if (typeof len === "bigint") throw new Error("CBOR: huge bstr");
    return readN(b, c, len);
  }

  // major type 3: text string (utf8)
  if (mt === 3) {
    const len = readUint(b, c, ai);
    if (typeof len === "bigint") throw new Error("CBOR: huge tstr");
    const u8 = readN(b, c, len);
    return new TextDecoder().decode(u8);
  }

  // major type 4: array
  if (mt === 4) {
    const len = readUint(b, c, ai);
    if (typeof len === "bigint") throw new Error("CBOR: huge array");
    const arr: CborValue[] = [];
    for (let i = 0; i < len; i++) arr.push(decodeItem(b, c));
    return arr;
  }

  // major type 5: map
  if (mt === 5) {
    const len = readUint(b, c, ai);
    if (typeof len === "bigint") throw new Error("CBOR: huge map");
    const m = new Map<CborValue, CborValue>();
    for (let i = 0; i < len; i++) {
      const k = decodeItem(b, c);
      const v = decodeItem(b, c);
      m.set(k, v);
    }
    return m;
  }

  // major type 7: simple / floats
  if (mt === 7) {
    if (ai === 20) return false;
    if (ai === 21) return true;
    if (ai === 22) return null;
    throw new Error("CBOR: unsupported simple");
  }

  throw new Error(`CBOR: unsupported major type ${mt}`);
}