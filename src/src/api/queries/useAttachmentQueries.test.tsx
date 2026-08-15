// Tier 1 tests for `useAttachmentMetadata`.
//
// Pins the regression behind "Uncaught TypeError: can't access property
// 'key', e is null" that fired when a public user opened a share whose
// note had at least one attachment. The chain:
//
//   1. `useAttachments` queryFn calls `attachmentApi.getAttachmentMetadata`
//      for each attachment key. When the backend returns non-ok (e.g. a
//      share that doesn't grant access to every attachment), the API
//      returns `null` and `queryFn` pushes it into the per-note array.
//   2. `AttachmentPreviewModal` mounts at the editor root and calls
//      `useAttachmentMetadata(noteId, key)` even before the user clicks
//      an image (the modal is always rendered with `key ?? ""`).
//   3. `initialData` reads the per-note cache and calls
//      `cached?.find((a) => a.key === key)`. Without the null guard,
//      iterating a `null` entry throws `TypeError`.
//
// The fix is the `?.` on `a?.key`; the assertions below pin that the
// hook survives a `null`-bearing cache AND still resolves a real key.

// @vitest-environment jsdom

import "../../test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AttachmentMetadata } from "../models/attachment";
import {
  type AttachmentMetadataList,
  useAttachmentMetadata,
} from "./useAttachmentQueries";

const NOTE_ID = "note-public-1";
const KEYS = {
  publicImage: "att-public-image",
  publicPdf: "att-public-pdf",
  hiddenImage: "att-hidden-image",
};

const buildCacheEntry = (key: string): AttachmentMetadata => ({
  key,
  filename: `${key}.bin`,
  content_type: "application/octet-stream",
  size_bytes: 1024,
  created_at: "2026-08-15T00:00:00Z",
});

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  // Fresh client per test so cache state from one case doesn't bleed
  // into the next. The singleton `queryClient` is owned by the app's
  // `<PersistQueryClientProvider>` and shares state across tests,
  // which is the wrong surface for a unit test.
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("useAttachmentMetadata - initialData null-safety", () => {
  it("does not put the query into an error state when the per-note cache contains null entries", () => {
    // Mirrors what `useAttachments`'s queryFn writes for a public
    // share that doesn't grant access to every attachment: a mix of
    // real metadata and `null` for the ones the backend rejected.
    // Lead with `null` so `find` reaches it before the match — the
    // crash happens inside `initialData` and TanStack Query captures
    // it as the query's error state (so `renderHook` itself doesn't
    // throw). Pin the error state directly.
    queryClient.setQueryData<AttachmentMetadataList>(
      ["attachments", NOTE_ID],
      [
        null,
        buildCacheEntry(KEYS.publicImage),
        null,
        buildCacheEntry(KEYS.publicPdf),
        null,
      ],
    );

    const { result } = renderHook(
      () => useAttachmentMetadata(NOTE_ID, KEYS.publicImage),
      { wrapper },
    );

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(buildCacheEntry(KEYS.publicImage));
  });

  it("resolves the matching metadata even when nulls sit ahead of it", () => {
    // `find` iterates left-to-right; without the null guard, the
    // leading `null` would throw before the predicate ever reached
    // the real entry. Pin that the real key still wins.
    queryClient.setQueryData<AttachmentMetadataList>(
      ["attachments", NOTE_ID],
      [null, buildCacheEntry(KEYS.publicImage), null],
    );

    const { result } = renderHook(
      () => useAttachmentMetadata(NOTE_ID, KEYS.publicImage),
      { wrapper },
    );

    expect(result.current.data).toEqual(buildCacheEntry(KEYS.publicImage));
  });

  it("resolves the matching metadata when nulls sit after it", () => {
    // Belt-and-braces: also pin that nulls after the match don't
    // matter (they would only matter if `find` continued past the
    // first match, which it doesn't, but explicit is cheap).
    queryClient.setQueryData<AttachmentMetadataList>(
      ["attachments", NOTE_ID],
      [buildCacheEntry(KEYS.publicImage), null, null],
    );

    const { result } = renderHook(
      () => useAttachmentMetadata(NOTE_ID, KEYS.publicImage),
      { wrapper },
    );

    expect(result.current.data).toEqual(buildCacheEntry(KEYS.publicImage));
  });

  it("returns undefined for a key the cache doesn't contain", () => {
    // No crash when the key is unknown AND the cache has nulls.
    queryClient.setQueryData<AttachmentMetadataList>(
      ["attachments", NOTE_ID],
      [null, buildCacheEntry(KEYS.publicImage), null],
    );

    const { result } = renderHook(
      () => useAttachmentMetadata(NOTE_ID, KEYS.hiddenImage),
      { wrapper },
    );

    expect(result.current.data).toBeUndefined();
  });
});
