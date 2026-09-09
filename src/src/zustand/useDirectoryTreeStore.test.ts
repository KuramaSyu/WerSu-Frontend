// Tier-1 unit tests for useDirectoryTreeStore.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";

import { useDirectoryTreeStore } from "./useDirectoryTreeStore";
import { useSelectedShelfStore } from "./useSelectedShelfStore";
import type { DirectoryReply } from "../api/models/directory";
import type { MinimalNote } from "../api/models/search";
import { ShelfHirarchyItem } from "../models/HirarchyItem";

const directoryLookup: Record<string, DirectoryReply> = {
  "dir-on-shelf": {
    id: "dir-on-shelf",
    name: "on-shelf",
    display_name: "On Shelf",
    parent_dir_ids: [],
    child_dir_ids: ["dir-grandchild"],
    child_note_ids: [],
    shelf_ids: ["shelf-1"],
  },
  "dir-grandchild": {
    id: "dir-grandchild",
    name: "grandchild",
    display_name: "Grandchild",
    parent_dir_ids: ["dir-on-shelf"],
    child_dir_ids: [],
    child_note_ids: [],
    shelf_ids: [],
  },
  "dir-other": {
    id: "dir-other",
    name: "other",
    display_name: "Other",
    parent_dir_ids: [],
    child_dir_ids: [],
    child_note_ids: [],
    shelf_ids: ["shelf-2"],
  },
};

const noteOnShelf: MinimalNote = {
  id: "n-on",
  title: "On shelf",
  author_id: "author",
  updated_at: "2026-01-01T00:00:00Z",
  stripped_content: "",
  directory_ids: ["dir-on-shelf"],
  tag_ids: [],
};

beforeEach(() => {
  useDirectoryTreeStore.setState({ tree: null });
  useSelectedShelfStore.setState({ selectedShelfId: null });
});

describe("useDirectoryTreeStore", () => {
  it("builds a ShelfHirarchyItem when a shelf is selected", () => {
    useSelectedShelfStore.getState().setSelectedShelfId("shelf-1");
    useDirectoryTreeStore.getState().rebuild(directoryLookup, [noteOnShelf]);

    const tree = useDirectoryTreeStore.getState().tree;
    expect(tree).not.toBeNull();
    // The build() helper returns the ShelfHirarchyItem as the root.
    expect(tree).toBeInstanceOf(ShelfHirarchyItem);
    expect(tree?.getId()).toBe("shelf-1");

    // Top-level: only dir-on-shelf is a direct shelf member;
    // dir-other belongs to shelf-2 so it's pruned.
    const topLevelIds =
      tree
        ?.getChildren()
        .map((c) => c.getId())
        .sort() ?? [];
    expect(topLevelIds).toEqual(["dir-on-shelf"]);

    // dir-grandchild survives transitively under dir-on-shelf
    // even though it doesn't list shelf-1 in its own shelf_ids.
    // The note (n-on) lives under dir-on-shelf too because
    // rebuild was called with [noteOnShelf].
    const dirOnShelf = tree
      ?.getChildren()
      .find((c) => c.getId() === "dir-on-shelf");
    expect(
      dirOnShelf
        ?.getChildren()
        .map((c) => c.getId())
        .sort(),
    ).toEqual(["dir-grandchild", "n-on"]);
  });

  it("builds a plain RootHirarchyItem when no shelf is selected", () => {
    useDirectoryTreeStore.getState().rebuild(directoryLookup, []);
    const tree = useDirectoryTreeStore.getState().tree;
    expect(tree).not.toBeNull();
    // The legacy "root" id stays intact so existing views keep working.
    expect(tree?.getId()).toBe("root");
    // Only top-level directories are direct children of the root;
    // dir-grandchild is nested under dir-on-shelf.
    expect(
      tree
        ?.getChildren()
        .map((c) => c.getId())
        .sort(),
    ).toEqual(["dir-on-shelf", "dir-other"]);
  });

  it("isDirectoryOnShelf accepts direct and transitive members", () => {
    useSelectedShelfStore.getState().setSelectedShelfId("shelf-1");
    useDirectoryTreeStore.getState().rebuild(directoryLookup, []);

    expect(
      useDirectoryTreeStore
        .getState()
        .isDirectoryOnShelf("dir-on-shelf", "shelf-1"),
    ).toBe(true);
    expect(
      useDirectoryTreeStore
        .getState()
        .isDirectoryOnShelf("dir-grandchild", "shelf-1"),
    ).toBe(true);
    expect(
      useDirectoryTreeStore
        .getState()
        .isDirectoryOnShelf("dir-other", "shelf-1"),
    ).toBe(false);
  });

  it("isDirectoryOnShelf returns true for every id when no shelf is active", () => {
    useDirectoryTreeStore.getState().rebuild(directoryLookup, []);
    for (const dir of Object.keys(directoryLookup)) {
      expect(useDirectoryTreeStore.getState().isDirectoryOnShelf(dir, "")).toBe(
        true,
      );
    }
  });

  it("isNoteOnShelf respects the active shelf via parent directory ids", () => {
    useSelectedShelfStore.getState().setSelectedShelfId("shelf-1");
    useDirectoryTreeStore.getState().rebuild(directoryLookup, [noteOnShelf]);

    expect(
      useDirectoryTreeStore.getState().isNoteOnShelf(noteOnShelf, "shelf-1"),
    ).toBe(true);

    const otherNote: MinimalNote = {
      ...noteOnShelf,
      id: "n-off",
      directory_ids: ["dir-other"],
    };
    expect(
      useDirectoryTreeStore.getState().isNoteOnShelf(otherNote, "shelf-1"),
    ).toBe(false);
  });

  it("clear drops the tree so helpers return false", () => {
    useSelectedShelfStore.getState().setSelectedShelfId("shelf-1");
    useDirectoryTreeStore.getState().rebuild(directoryLookup, []);
    useDirectoryTreeStore.getState().clear();

    expect(useDirectoryTreeStore.getState().tree).toBeNull();
    expect(
      useDirectoryTreeStore
        .getState()
        .isDirectoryOnShelf("dir-on-shelf", "shelf-1"),
    ).toBe(false);
  });
});
