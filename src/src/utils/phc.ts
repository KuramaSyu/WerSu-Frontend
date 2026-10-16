// Browser-side argon2id -> PHC string. Server never sees plaintext.

import { argon2idAsync } from "@noble/hashes/argon2";
import { randomBytes } from "@noble/hashes/utils";

/** Argon2id parameters pinned for every PHC we emit. */
export const ARGON2_PROFILE = {
  t: 3,
  m: 64 * 1024,
  p: 1,
  dkLen: 32,
} as const;

/** Salt length in bytes. 16 bytes (128 bits) is canonical. */
const SALT_BYTES = 16;

/** URL-safe base64 alphabet, no padding. */
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Encode bytes as URL-safe base64 without padding. */
function toBase64UrlNoPad(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    if (i + 1 < bytes.length) out += BASE64_ALPHABET[(triple >> 6) & 0x3f];
    if (i + 2 < bytes.length) out += BASE64_ALPHABET[triple & 0x3f];
  }
  return out;
}

/** Decode URL-safe base64 without padding. Returns null on malformed input. */
function fromBase64UrlNoPad(input: string): Uint8Array | null {
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    const v = code < 128 ? (lookup[code] ?? -1) : -1;
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Strict regex for the PHC strings we emit and accept. */
const PHC_RE =
  /^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/;

/** True when phc matches the argon2id PHC grammar. */
export function isPhcString(phc: string): boolean {
  return PHC_RE.test(phc);
}

/** Hash plaintext with argon2id and return a PHC string with a fresh 16-byte salt. */
export async function hashPasswordPhc(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await argon2idAsync(plaintext, salt, {
    t: ARGON2_PROFILE.t,
    m: ARGON2_PROFILE.m,
    p: ARGON2_PROFILE.p,
    dkLen: ARGON2_PROFILE.dkLen,
  });
  return (
    `$argon2id$v=19` +
    `$m=${ARGON2_PROFILE.m},t=${ARGON2_PROFILE.t},p=${ARGON2_PROFILE.p}` +
    `$${toBase64UrlNoPad(salt)}` +
    `$${toBase64UrlNoPad(hash)}`
  );
}

/** Constant-time check that plaintext hashes to phc. Returns false on malformed PHC. */
export async function verifyPasswordPhc(
  plaintext: string,
  phc: string,
): Promise<boolean> {
  const parsed = parsePhc(phc);
  if (parsed === null) return false;
  const candidate = await argon2idAsync(plaintext, parsed.salt, {
    t: parsed.t,
    m: parsed.m,
    p: parsed.p,
    dkLen: parsed.hash.length,
  });
  return constantTimeEqual(candidate, parsed.hash);
}

interface ParsedPhc {
  m: number;
  t: number;
  p: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

function parsePhc(phc: string): ParsedPhc | null {
  if (!PHC_RE.test(phc)) return null;
  const parts = phc.split("$");
  // 6 parts: ["", "argon2id", "v=19", "m=...,t=...,p=...", "<salt>", "<hash>"]
  if (parts.length !== 6) return null;
  const params = new Map(
    (parts[3] ?? "").split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k ?? "", Number(v)];
    }),
  );
  const salt = fromBase64UrlNoPad(parts[4] ?? "");
  const hash = fromBase64UrlNoPad(parts[5] ?? "");
  if (salt === null || hash === null) return null;
  const m = params.get("m");
  const t = params.get("t");
  const p = params.get("p");
  if (
    typeof m !== "number" ||
    typeof t !== "number" ||
    typeof p !== "number" ||
    !Number.isFinite(m) ||
    !Number.isFinite(t) ||
    !Number.isFinite(p)
  ) {
    return null;
  }
  return { m, t, p, salt, hash };
}

/** Constant-time byte comparison. Inputs must be the same length. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
