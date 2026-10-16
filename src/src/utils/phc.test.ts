// Unit tests for phc.ts.

import { describe, expect, it } from "vitest";
import {
  ARGON2_PROFILE,
  hashPasswordPhc,
  isPhcString,
  verifyPasswordPhc,
} from "./phc";

// argon2id with m=64 MiB is slow in jsdom; per-test timeout must be wide.
const HASH_TIMEOUT = 60_000;

describe("hashPasswordPhc", () => {
  it(
    "produces a PHC string matching the argon2id grammar",
    { timeout: HASH_TIMEOUT },
    async () => {
      const phc = await hashPasswordPhc("correct horse battery staple");
      expect(isPhcString(phc)).toBe(true);
      expect(phc.startsWith(`$argon2id$v=19$m=${ARGON2_PROFILE.m},`)).toBe(
        true,
      );
    },
  );

  it(
    "encodes the configured argon2 profile in the PHC params",
    { timeout: HASH_TIMEOUT },
    async () => {
      const phc = await hashPasswordPhc("hunter2");
      expect(phc).toContain(`m=${ARGON2_PROFILE.m}`);
      expect(phc).toContain(`t=${ARGON2_PROFILE.t}`);
      expect(phc).toContain(`p=${ARGON2_PROFILE.p}`);
    },
  );

  it(
    "emits a fresh salt every call (same plaintext -> different PHC)",
    { timeout: HASH_TIMEOUT },
    async () => {
      const a = await hashPasswordPhc("hunter2");
      const b = await hashPasswordPhc("hunter2");
      expect(a).not.toBe(b);
    },
  );

  it(
    "hashes different plaintexts to different PHCs",
    { timeout: HASH_TIMEOUT },
    async () => {
      const a = await hashPasswordPhc("hunter2");
      const b = await hashPasswordPhc("hunter3");
      expect(a).not.toBe(b);
    },
  );
});

describe("verifyPasswordPhc", () => {
  it(
    "returns true for the right password",
    { timeout: HASH_TIMEOUT },
    async () => {
      const phc = await hashPasswordPhc("correct horse battery staple");
      expect(await verifyPasswordPhc("correct horse battery staple", phc)).toBe(
        true,
      );
    },
  );

  it(
    "returns false for the wrong password",
    { timeout: HASH_TIMEOUT },
    async () => {
      const phc = await hashPasswordPhc("correct horse battery staple");
      expect(
        await verifyPasswordPhc("incorrect horse battery staple", phc),
      ).toBe(false);
    },
  );

  it("returns false for malformed PHC input", async () => {
    expect(await verifyPasswordPhc("anything", "not-a-phc-string")).toBe(false);
    expect(await verifyPasswordPhc("anything", "")).toBe(false);
    expect(
      await verifyPasswordPhc(
        "anything",
        "$argon2id$v=19$m=65536,t=3,p=1$short",
      ),
    ).toBe(false);
  });

  it(
    "rejects a PHC whose salt has been tampered with",
    { timeout: HASH_TIMEOUT },
    async () => {
      const phc = await hashPasswordPhc("hunter2");
      const splitAt = phc.indexOf("$", 30) + 1;
      const tamperedSaltFirstChar = phc[splitAt] === "A" ? "B" : "A";
      const tampered =
        phc.slice(0, splitAt) + tamperedSaltFirstChar + phc.slice(splitAt + 1);
      expect(await verifyPasswordPhc("hunter2", tampered)).toBe(false);
    },
  );
});

describe("isPhcString", () => {
  it("accepts canonical argon2id PHCs", { timeout: HASH_TIMEOUT }, async () => {
    const phc = await hashPasswordPhc("hunter2");
    expect(isPhcString(phc)).toBe(true);
  });

  it("rejects bcrypt and pbkdf2 PHCs", () => {
    expect(isPhcString("$2b$10$abc$def")).toBe(false);
    expect(isPhcString("$pbkdf2-sha256$1$abc$def")).toBe(false);
  });

  it("rejects argon2i (the wrong variant)", () => {
    expect(isPhcString("$argon2i$v=19$m=65536,t=3,p=1$abcd$efgh")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isPhcString("")).toBe(false);
    expect(isPhcString("$argon2id$")).toBe(false);
  });
});
