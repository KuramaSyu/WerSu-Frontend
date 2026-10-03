// Tier-1 unit test for resolveShareAttachmentToken.
// Tries bare id, attachments prefix, then suffix match.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "./useAuthStore";

describe("useAuthStore.resolveShareAttachmentToken", () => {
  beforeEach(() => {
    useAuthStore.getState().setShareAttachmentTokens({});
  });

  it("returns undefined when the map is empty", () => {
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toBeUndefined();
  });

  it("matches a bare id when the map stores it bare", () => {
    useAuthStore.getState().setShareAttachmentTokens({ "att-1": "jwt-a" });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toEqual({ jwt: "jwt-a", key: "att-1" });
  });

  it("matches when the map uses the attachments prefix but the caller has bare", () => {
    useAuthStore
      .getState()
      .setShareAttachmentTokens({ "attachments/att-1": "jwt-a" });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toEqual({ jwt: "jwt-a", key: "attachments/att-1" });
  });

  it("matches a deeper attachments/dir/id entry by suffix", () => {
    useAuthStore
      .getState()
      .setShareAttachmentTokens({ "attachments/dir-7/att-1": "jwt-a" });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toEqual({ jwt: "jwt-a", key: "attachments/dir-7/att-1" });
  });

  it("prefers the exact match over a prefix or suffix one", () => {
    useAuthStore.getState().setShareAttachmentTokens({
      "att-1": "jwt-exact",
      "attachments/att-1": "jwt-prefix",
      "other/att-1": "jwt-suffix",
    });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toEqual({ jwt: "jwt-exact", key: "att-1" });
  });

  it("prefers the prefix match over a suffix one", () => {
    useAuthStore.getState().setShareAttachmentTokens({
      "attachments/att-1": "jwt-prefix",
      "other/att-1": "jwt-suffix",
    });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toEqual({ jwt: "jwt-prefix", key: "attachments/att-1" });
  });

  it("returns undefined when no map entry matches any form", () => {
    useAuthStore
      .getState()
      .setShareAttachmentTokens({ "attachments/att-2": "jwt-a" });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toBeUndefined();
  });
});
