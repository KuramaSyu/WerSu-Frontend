// Pure-helper tests for `shareFormModel.ts` — the form value factory
// and the default-description builder used by ShareDialog.

import { describe, expect, it } from "vitest";
import {
  blankShareFormValue,
  defaultShareDescription,
  NEVER_EXPIRES,
  SCHEDULE_OPTIONS,
} from "./shareFormModel";

describe("defaultShareDescription", () => {
  it("includes the note title when one is given", () => {
    expect(defaultShareDescription("My Note")).toBe("Shared note: My Note");
  });

  it("trims surrounding whitespace before composing the default", () => {
    expect(defaultShareDescription("   My Note   ")).toBe(
      "Shared note: My Note",
    );
  });

  it("returns an empty string when the title is empty", () => {
    expect(defaultShareDescription("")).toBe("");
  });

  it("returns an empty string when the title is whitespace-only", () => {
    expect(defaultShareDescription("   \t\n")).toBe("");
  });
});

describe("blankShareFormValue", () => {
  it("seeds the description with the note title when one is given", () => {
    const form = blankShareFormValue("My Note");
    expect(form.description).toBe("Shared note: My Note");
  });

  it("leaves the description empty when no title is passed", () => {
    const form = blankShareFormValue();
    expect(form.description).toBe("");
  });

  it("leaves the description empty when the title is whitespace-only", () => {
    const form = blankShareFormValue("   ");
    expect(form.description).toBe("");
  });

  it("defaults to link-shared, read-only", () => {
    const form = blankShareFormValue("My Note");
    expect(form.visibility).toBe("link");
    expect(form.permission).toBe("read");
  });

  it("sets onlineUntil to a future timestamp (~one month out)", () => {
    const before = Date.now();
    const form = blankShareFormValue("My Note");
    const expiry = Date.parse(form.onlineUntil);
    expect(Number.isNaN(expiry)).toBe(false);
    // Roughly one month in the future — pin a 10-second tolerance to
    // dodge CI jitter.
    const oneMonth = 60 * 60 * 24 * 30 * 1000;
    expect(expiry).toBeGreaterThan(before + oneMonth - 10_000);
    expect(expiry).toBeLessThan(before + oneMonth + 10_000);
  });
});

describe("NEVER_EXPIRES", () => {
  it("is the null sentinel used by the schedule chips", () => {
    expect(NEVER_EXPIRES).toBe(null);
  });
});

describe("SCHEDULE_OPTIONS", () => {
  it("exposes the canonical preset chips", () => {
    const labels = SCHEDULE_OPTIONS.map((o) => o.children);
    expect(labels).toEqual(["1H", "1D", "1W", "1M", "3M", "1Y", "Never"]);
  });

  it("treats the 'Never' entry as the NEVER_EXPIRES sentinel", () => {
    const never = SCHEDULE_OPTIONS.find((o) => o.children === "Never");
    expect(never?.value).toBe(NEVER_EXPIRES);
  });
});
