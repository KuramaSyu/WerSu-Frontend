// Tier-1 unit test for `useAuthStore.resolveShareAttachmentToken`.
//
// The map's keys may be a bare id, attachments/<id>, or
// attachments/<dir>/<id> depending on the backend's S3 path layout,
// so the resolver tries all three forms before giving up. The NodeView
// hands the resolved key straight to AttachmentLinkBuilder, so the
// returned key must match whatever the backend stored.

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

  it("matches when the map uses attachments/<id> but the caller has bare", () => {
    useAuthStore
      .getState()
      .setShareAttachmentTokens({ "attachments/att-1": "jwt-a" });
    expect(
      useAuthStore.getState().resolveShareAttachmentToken("att-1"),
    ).toEqual({ jwt: "jwt-a", key: "attachments/att-1" });
  });

  it("matches a deeper attachments/<dir>/<id> entry by suffix", () => {
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
