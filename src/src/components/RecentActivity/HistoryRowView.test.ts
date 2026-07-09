// Pure-helper tests for the HistoryRowView module. The React
// component itself is unmounted on purpose here -- the rendering
// path uses MUI `useThemeStore` and pulls from the query cache,
// both of which we'd rather cover with an end-to-end test than
// mock into a unit test. If we want a frontend test for that
// later, we'll add one (per the user's "ask first" rule).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { queryClient } from "../../api/queryClient";
import { Note } from "../../api/models/search";
import type { ActivityKind } from "../../api/models/history";
import {
  ACTION_VARIANT,
  CREATED_ACTIONS,
  DIRECTORY_TARGET_ACTIONS,
  extractNoteMetadata,
  formatHistoryRowLabel,
  formatHistoryRowTimestamp,
  getHistoryRowKind,
  hasScore,
  isArchivedRow,
  isCreatedRow,
  isDeletedRow,
  isDirectoryEvent,
  isEditedRow,
  isNoteEvent,
  isPublishedRow,
  isRestoredRow,
  isRoleEvent,
  isSharedRow,
  isTrendingRow,
  isViewedRow,
  NOTE_TARGET_ACTIONS,
  ROLE_TARGET_ACTIONS,
  VARIANT_META,
  type HistoryRowEntry,
  type HistoryRowKind,
} from "./HistoryRowFeatures";

const NOTE_ID = "note-1";
const NOTE_TITLE = "My Title";

const cachedNote = new Note({
  id: NOTE_ID,
  title: NOTE_TITLE,
  author_id: "user-1",
  updated_at: "2026-07-01T00:00:00Z",
  stripped_content: "",
  content: "",
});

const baseRow = (
  overrides: Partial<HistoryRowEntry> = {},
): HistoryRowEntry => ({
  note_id: NOTE_ID,
  at: "2026-07-06T12:00:00Z",
  action: "note_edited",
  ...overrides,
});

const ALL_KINDS: ReadonlyArray<ActivityKind> = [
  "note_viewed",
  "note_created",
  "note_edited",
  "note_deleted",
  "note_published",
  "note_shared",
  "note_unshared",
  "note_restored",
  "note_archived",
  "note_version_restored",
  "note_attachment_added",
  "directory_created",
  "directory_viewed",
  "directory_edited",
  "directory_deleted",
  "role_grant",
  "role_revoke",
  "role_change",
];

describe("target-action sets", () => {
  it("NOTE_TARGET_ACTIONS contains every note_* kind", () => {
    const noteKinds = ALL_KINDS.filter((k) => k.startsWith("note_"));
    for (const k of noteKinds) {
      expect(NOTE_TARGET_ACTIONS.has(k)).toBe(true);
    }
  });

  it("DIRECTORY_TARGET_ACTIONS contains every directory_* kind", () => {
    const dirKinds = ALL_KINDS.filter((k) => k.startsWith("directory_"));
    for (const k of dirKinds) {
      expect(DIRECTORY_TARGET_ACTIONS.has(k)).toBe(true);
    }
  });

  it("ROLE_TARGET_ACTIONS contains every role_* kind", () => {
    const roleKinds = ALL_KINDS.filter((k) => k.startsWith("role_"));
    for (const k of roleKinds) {
      expect(ROLE_TARGET_ACTIONS.has(k)).toBe(true);
    }
  });

  it("CREATED_ACTIONS only contains note_created and directory_created", () => {
    expect(CREATED_ACTIONS.size).toBe(2);
    expect(CREATED_ACTIONS.has("note_created")).toBe(true);
    expect(CREATED_ACTIONS.has("directory_created")).toBe(true);
  });
});

describe("ACTION_VARIANT routing", () => {
  it("covers every known ActivityKind literal", () => {
    // Strict pin: every literal in the union must have an entry.
    // If `ActivityKind` grows, this fails closed until the new
    // literal is added here too.
    const routed: ActivityKind[] = Object.keys(
      ACTION_VARIANT,
    ) as ActivityKind[];
    for (const k of ALL_KINDS) {
      expect(routed).toContain(k);
    }
  });

  it("maps each kind to a distinct, named bucket", () => {
    // Spot-check the routing table. If a kind's bucket regresses
    // back to a generic "edited" or shares a bucket with another
    // kind, this fails.
    const expected: Record<ActivityKind, HistoryRowKind> = {
      note_viewed: "viewed",
      note_created: "created",
      note_edited: "edited",
      note_deleted: "deleted",
      note_published: "published",
      note_shared: "shared",
      note_unshared: "unshared",
      note_restored: "restored",
      note_archived: "archived",
      note_version_restored: "version_restored",
      note_attachment_added: "attachment_added",
      directory_created: "directory_created",
      directory_viewed: "directory_viewed",
      directory_edited: "directory_edited",
      directory_deleted: "directory_deleted",
      role_grant: "role_granted",
      role_revoke: "role_revoked",
      role_change: "role_changed",
    };
    for (const k of ALL_KINDS) {
      expect(ACTION_VARIANT[k]).toBe(expected[k]);
    }
  });
});

describe("getHistoryRowKind", () => {
  it("routes each kind via ACTION_VARIANT", () => {
    for (const action of ALL_KINDS) {
      expect(getHistoryRowKind(baseRow({ action }))).toBe(
        ACTION_VARIANT[action],
      );
    }
  });

  it("maps a row without action -> 'unknown'", () => {
    expect(getHistoryRowKind({ note_id: NOTE_ID })).toBe("unknown");
  });

  it("maps any row with score -> 'trending', regardless of action", () => {
    for (const action of ALL_KINDS) {
      expect(getHistoryRowKind(baseRow({ action, score: 1 }))).toBe("trending");
    }
    // No-action + score
    expect(getHistoryRowKind({ note_id: NOTE_ID, score: 7 })).toBe("trending");
  });

  it("score wins for both created-action kinds", () => {
    expect(
      getHistoryRowKind(baseRow({ action: "note_created", score: 5 })),
    ).toBe("trending");
    expect(
      getHistoryRowKind(baseRow({ action: "directory_created", score: 5 })),
    ).toBe("trending");
  });

  it("every kind routes deterministically (exhaustive walk)", () => {
    const validVariants = new Set<HistoryRowKind>(
      Object.keys(VARIANT_META) as HistoryRowKind[],
    );
    for (const action of ALL_KINDS) {
      expect(validVariants).toContain(getHistoryRowKind(baseRow({ action })));
    }
    expect(validVariants).toContain(getHistoryRowKind({ note_id: NOTE_ID }));
    expect(validVariants).toContain(
      getHistoryRowKind({ note_id: NOTE_ID, score: 1 }),
    );
  });
});

describe("hasScore", () => {
  it("is true when score is a finite number", () => {
    expect(hasScore(baseRow({ score: 0 }))).toBe(true);
    expect(hasScore(baseRow({ score: 12.5 }))).toBe(true);
  });

  it("is false when score is undefined", () => {
    expect(hasScore(baseRow())).toBe(false);
  });

  it("is true even for score=0 (zero IS a measurement)", () => {
    expect(hasScore(baseRow({ score: 0 }))).toBe(true);
  });
});

describe("per-variant predicates", () => {
  it("isCreatedRow matches only note_created", () => {
    // `directory_created` has its own bucket (`directory_created`);
    // use `ACTION_VARIANT[action] === "directory_created"` if you
    // want to test that direction.
    expect(isCreatedRow(baseRow({ action: "note_created" }))).toBe(true);
    expect(isCreatedRow(baseRow({ action: "directory_created" }))).toBe(false);
    expect(isCreatedRow(baseRow({ action: "note_edited" }))).toBe(false);
    expect(isCreatedRow(baseRow({ action: "note_viewed" }))).toBe(false);
  });

  it("isEditedRow matches only the plain edit kind", () => {
    expect(isEditedRow(baseRow({ action: "note_edited" }))).toBe(true);
    // What's NOT edited: every non-edit kind.
    for (const action of ALL_KINDS) {
      if (action === "note_edited") continue;
      expect(isEditedRow(baseRow({ action }))).toBe(false);
    }
  });

  it("isTrendingRow matches only rows with a score", () => {
    expect(isTrendingRow(baseRow({ score: 5 }))).toBe(true);
    expect(isTrendingRow(baseRow())).toBe(false);
  });

  it("isViewedRow matches only note_viewed", () => {
    expect(isViewedRow(baseRow({ action: "note_viewed" }))).toBe(true);
    for (const action of ALL_KINDS) {
      if (action === "note_viewed") continue;
      expect(isViewedRow(baseRow({ action }))).toBe(false);
    }
  });

  it("isPublishedRow matches only note_published", () => {
    expect(isPublishedRow(baseRow({ action: "note_published" }))).toBe(true);
    for (const action of ALL_KINDS) {
      if (action === "note_published") continue;
      expect(isPublishedRow(baseRow({ action }))).toBe(false);
    }
  });

  it("isSharedRow covers shared + unshared", () => {
    expect(isSharedRow(baseRow({ action: "note_shared" }))).toBe(true);
    expect(isSharedRow(baseRow({ action: "note_unshared" }))).toBe(true);
    for (const action of ALL_KINDS) {
      if (action === "note_shared" || action === "note_unshared") continue;
      expect(isSharedRow(baseRow({ action }))).toBe(false);
    }
  });

  it("isDeletedRow covers note_deleted + directory_deleted", () => {
    expect(isDeletedRow(baseRow({ action: "note_deleted" }))).toBe(true);
    expect(isDeletedRow(baseRow({ action: "directory_deleted" }))).toBe(true);
    for (const action of ALL_KINDS) {
      if (action === "note_deleted" || action === "directory_deleted") {
        continue;
      }
      expect(isDeletedRow(baseRow({ action }))).toBe(false);
    }
  });

  it("isArchivedRow matches only note_archived", () => {
    expect(isArchivedRow(baseRow({ action: "note_archived" }))).toBe(true);
    for (const action of ALL_KINDS) {
      if (action === "note_archived") continue;
      expect(isArchivedRow(baseRow({ action }))).toBe(false);
    }
  });

  it("isRestoredRow covers restored + version_restored", () => {
    expect(isRestoredRow(baseRow({ action: "note_restored" }))).toBe(true);
    expect(isRestoredRow(baseRow({ action: "note_version_restored" }))).toBe(
      true,
    );
    for (const action of ALL_KINDS) {
      if (action === "note_restored" || action === "note_version_restored") {
        continue;
      }
      expect(isRestoredRow(baseRow({ action }))).toBe(false);
    }
  });
});

describe("isNoteEvent / isDirectoryEvent / isRoleEvent", () => {
  it("isNoteEvent matches note_* kinds", () => {
    for (const k of ALL_KINDS.filter((x) => x.startsWith("note_"))) {
      expect(isNoteEvent(baseRow({ action: k }))).toBe(true);
    }
    for (const k of ALL_KINDS.filter((x) => !x.startsWith("note_"))) {
      expect(isNoteEvent(baseRow({ action: k }))).toBe(false);
    }
  });

  it("isDirectoryEvent matches directory_* kinds", () => {
    for (const k of ALL_KINDS.filter((x) => x.startsWith("directory_"))) {
      expect(isDirectoryEvent(baseRow({ action: k }))).toBe(true);
    }
    for (const k of ALL_KINDS.filter((x) => !x.startsWith("directory_"))) {
      expect(isDirectoryEvent(baseRow({ action: k }))).toBe(false);
    }
  });

  it("isRoleEvent matches role_* kinds", () => {
    for (const k of ALL_KINDS.filter((x) => x.startsWith("role_"))) {
      expect(isRoleEvent(baseRow({ action: k }))).toBe(true);
    }
    for (const k of ALL_KINDS.filter((x) => !x.startsWith("role_"))) {
      expect(isRoleEvent(baseRow({ action: k }))).toBe(false);
    }
  });

  it("target predicates are mutually exclusive (action-based)", () => {
    for (const action of ALL_KINDS) {
      const row = baseRow({ action });
      const sum =
        Number(isNoteEvent(row)) +
        Number(isDirectoryEvent(row)) +
        Number(isRoleEvent(row));
      expect(sum).toBe(1);
    }
  });

  it("target predicates return false when action is missing", () => {
    const row: HistoryRowEntry = { note_id: NOTE_ID };
    expect(isNoteEvent(row)).toBe(false);
    expect(isDirectoryEvent(row)).toBe(false);
    expect(isRoleEvent(row)).toBe(false);
  });
});

describe("formatHistoryRowLabel", () => {
  beforeAll(() => {
    queryClient.setQueryData(["notes", NOTE_ID], cachedNote);
  });

  afterAll(() => {
    queryClient.removeQueries({ queryKey: ["notes", NOTE_ID] });
  });

  it("returns the note title when the note is in the query cache", () => {
    expect(formatHistoryRowLabel(baseRow())).toBe(NOTE_TITLE);
  });

  it("falls back to the raw note_id when the note isn't cached", () => {
    expect(formatHistoryRowLabel(baseRow({ note_id: "unknown-note" }))).toBe(
      "unknown-note",
    );
  });

  it("ignores score when building the label (the chip handles it)", () => {
    expect(formatHistoryRowLabel(baseRow({ score: 42 }))).toBe(NOTE_TITLE);
  });
});

describe("formatHistoryRowTimestamp", () => {
  it("formats a recent timestamp as relative", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const out = formatHistoryRowTimestamp(fiveMinutesAgo);
    // Don't pin a precise string -- `formatDistanceToNow` is
    // verbose and locale-dependent. Just assert it produced
    // *something* that's not the raw input.
    expect(out).not.toBe(fiveMinutesAgo);
    expect(out.length).toBeGreaterThan(0);
  });

  it("falls back to the raw input on parse failure", () => {
    const bad = "not-a-date";
    expect(formatHistoryRowTimestamp(bad)).toBe(bad);
  });

  it("returns the raw input for an empty string", () => {
    expect(formatHistoryRowTimestamp("")).toBe("");
  });
});

describe("extractNoteMetadata", () => {
  const noteMetadata = (title: string, content: string): string =>
    JSON.stringify({ note_title: title, note_content: content });

  it("returns title and description for a note event with valid metadata", () => {
    const row = baseRow({ metadata_json: noteMetadata("Hello", "World body") });
    expect(extractNoteMetadata(row)).toEqual({
      title: "Hello",
      description: "World body",
    });
  });

  it("returns empty strings for a directory event", () => {
    const row = baseRow({
      action: "directory_created",
      metadata_json: noteMetadata("ignored", "ignored"),
    });
    expect(extractNoteMetadata(row)).toEqual({ title: "", description: "" });
  });

  it("returns empty strings for a role event", () => {
    const row = baseRow({
      action: "role_grant",
      metadata_json: noteMetadata("ignored", "ignored"),
    });
    expect(extractNoteMetadata(row)).toEqual({ title: "", description: "" });
  });

  it("returns empty strings when metadata_json is missing", () => {
    const row = baseRow({ metadata_json: undefined });
    expect(extractNoteMetadata(row)).toEqual({ title: "", description: "" });
  });

  it("returns empty strings when metadata_json is not valid JSON", () => {
    const row = baseRow({ metadata_json: "not-json{" });
    expect(extractNoteMetadata(row)).toEqual({ title: "", description: "" });
  });

  it("returns an empty title and a populated description when only note_content is present", () => {
    const row = baseRow({
      metadata_json: JSON.stringify({ note_content: "body" }),
    });
    expect(extractNoteMetadata(row)).toEqual({
      title: "",
      description: "body",
    });
  });

  it("returns a populated title and an empty description when only note_title is present", () => {
    const row = baseRow({
      metadata_json: JSON.stringify({ note_title: "Hello" }),
    });
    expect(extractNoteMetadata(row)).toEqual({
      title: "Hello",
      description: "",
    });
  });

  it("truncates the description to the 120-char cap via crumble", () => {
    const long = "x".repeat(500);
    const row = baseRow({ metadata_json: noteMetadata("Hello", long) });
    const { description } = extractNoteMetadata(row);
    expect(description.length).toBeLessThanOrEqual(120);
    expect(description.length).toBeGreaterThan(0);
  });

  it("returns title only when note_content is an empty string", () => {
    const row = baseRow({ metadata_json: noteMetadata("Hello", "") });
    expect(extractNoteMetadata(row)).toEqual({
      title: "Hello",
      description: "",
    });
  });

  it("ignores extra fields in the metadata payload", () => {
    const row = baseRow({
      metadata_json: JSON.stringify({
        note_title: "Hello",
        note_content: "body",
        future_field: 42,
      }),
    });
    expect(extractNoteMetadata(row)).toEqual({
      title: "Hello",
      description: "body",
    });
  });
});
