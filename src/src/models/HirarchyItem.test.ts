import { describe, expect, it } from "vitest";
import type { MinimalNote } from "../api/models/search";
import {
  DirectoryHierarchyBuilder,
  DirectoryHirarchyItem,
  NoteHierarchyBuilder,
  NoteHirarchyItem,
  RootHirarchyItem,
} from "./HirarchyItem";

/**
 * Minimal note fixture tailored for hierarchy tests.
 *
 * Most fields are static because hierarchy behavior only depends on id/title
 * and the parent directory ids.
 */
const makeNote = (id: string, title: string, directoryIds: string[] = []) =>
  ({
    id,
    title,
    author_id: "author",
    updated_at: "2026-01-01T00:00:00Z",
    stripped_content: "preview",
    directory_ids: directoryIds,
    tag_ids: [],
  }) satisfies MinimalNote;

describe("HirarchyItem", () => {
  it("creates a root node with fixed id and supports child operations", () => {
    // Arrange a root with one child note.
    const root = new RootHirarchyItem("Docs");
    const note = new NoteHirarchyItem("n1", "Welcome");

    // Act by adding the note to the root.
    root.addChild(note);

    // Assert root identity and initial child wiring.
    expect(root.getId()).toBe("root");
    expect(root.getName()).toBe("Docs");
    expect(root.getParent()).toBeUndefined();
    expect(root.getChildren()).toEqual([note]);
    // Iterator should expose the same direct children sequence.
    expect([...root]).toEqual([note]);

    // Removing an existing child succeeds and mutates child collection.
    expect(root.removeChild("n1")).toBe(true);
    expect(root.getChildren()).toEqual([]);
    // Removing a missing id should report false.
    expect(root.removeChild("missing")).toBe(false);
  });

  it("creates directory node from reply and resolves display name fallback", () => {
    // Case 1: display_name is provided and should be preferred for UI label.
    const withDisplayName = DirectoryHirarchyItem.fromDirectoryReply({
      id: "dir-1",
      name: "engineering",
      display_name: "Engineering",
      parent_dir_ids: ["root"],
      child_dir_ids: [],
      child_note_ids: [],
    });

    // Case 2: display_name is absent and slug should be used.
    const withSlugFallback = DirectoryHirarchyItem.fromDirectoryReply({
      id: "dir-2",
      slug: "notes",
      parent_dir_ids: [],
      child_dir_ids: [],
      child_note_ids: [],
    });

    // Wrapped data and resolved identity should remain intact.
    expect(withDisplayName.getId()).toBe("dir-1");
    expect(withDisplayName.getName()).toBe("Engineering");
    expect(withDisplayName.getParent()).toBe("root");
    expect(withDisplayName.getDirectory()).toEqual({
      id: "dir-1",
      name: "engineering",
      display_name: "Engineering",
      parent_dir_ids: ["root"],
      child_dir_ids: [],
      child_note_ids: [],
    });

    // Name fallback uses the slug when display_name is missing.
    expect(withSlugFallback.getName()).toBe("notes");
  });

  it("builds note node from directory_ids and enforces leaf behavior", () => {
    // Should pick the first id as the canonical parent.
    const noteWithParents = NoteHirarchyItem.fromNoteData(
      makeNote("note-1", "Spec", ["dir-9", "dir-12"]),
    );

    // Empty directory_ids means root-parented.
    const rootNote = NoteHirarchyItem.fromNoteData(
      makeNote("note-2", "Readme"),
    );

    // Parent extraction behavior.
    expect(noteWithParents.getParent()).toBe("dir-9");
    expect(noteWithParents.getParentDirectoryIds()).toEqual([
      "dir-9",
      "dir-12",
    ]);
    expect(rootNote.getParent()).toBeUndefined();
    expect(rootNote.getParentDirectoryIds()).toEqual([]);

    // Leaf identity and iteration behavior.
    expect(noteWithParents.getName()).toBe("Spec");
    expect(noteWithParents.getNoteId()).toBe("note-1");
    expect(noteWithParents.getChildren()).toEqual([]);
    expect([...noteWithParents]).toEqual([]);

    // Leaf node contract must reject adding children.
    expect(() => noteWithParents.addChild(rootNote)).toThrow(
      "Leaf nodes cannot add children.",
    );
    // Removing children from leaf should be a no-op.
    expect(noteWithParents.removeChild("child")).toBe(false);
  });

  it("groups notes by directory_ids and keeps unparented notes at root", () => {
    // Build mixed dataset: root-level notes, two directory buckets, and
    // one note parented under two directories at once.
    const notes: MinimalNote[] = [
      makeNote("n1", "Standalone"),
      makeNote("n2", "In A", ["dir-a"]),
      makeNote("n3", "Also In A", ["dir-a"]),
      makeNote("n4", "In B", ["dir-b"]),
      makeNote("n5", "In Both A and B", ["dir-a", "dir-b"]),
    ];

    // Build final hierarchy tree from note list.
    const root = new NoteHierarchyBuilder(notes).build("Workspace");

    expect(root.getName()).toBe("Workspace");

    // Root should contain: n1, dir-a, dir-b (order from insertion flow).
    const rootChildren = root.getChildren();
    expect(rootChildren).toHaveLength(3);

    // Lookup by id to make assertions order-independent for readability.
    const standalone = rootChildren.find((item) => item.getId() === "n1");
    const dirA = rootChildren.find((item) => item.getId() === "dir-a");
    const dirB = rootChildren.find((item) => item.getId() === "dir-b");

    // Notes without valid directory parent stay at root level.
    expect(standalone?.getName()).toBe("Standalone");

    // Synthetic directory nodes should have been created.
    expect(dirA).toBeDefined();
    expect(dirB).toBeDefined();

    // Synthetic directory naming currently mirrors the directory id.
    expect(dirA?.getName()).toBe("dir-a");
    // Synthetic directories are attached directly under root in this builder.
    expect(dirA?.getParent()).toBeUndefined();
    // Directory A should contain the two notes mapped to dir-a (plus the
    // multi-parent one).
    expect(
      dirA
        ?.getChildren()
        .map((child) => child.getId())
        .sort(),
    ).toEqual(["n2", "n3", "n5"]);

    // Directory B should contain only the two notes mapped to dir-b.
    expect(
      dirB
        ?.getChildren()
        .map((child) => child.getId())
        .sort(),
    ).toEqual(["n4", "n5"]);
  });

  it("builds directory hierarchy from directory lookup only", () => {
    // Build mixed directory map with nested, missing-parent, and root-level items.
    const directoryLookup = {
      "dir-root": {
        id: "dir-root",
        name: "root-dir",
        display_name: "Root Dir",
        parent_dir_ids: [],
        child_dir_ids: [],
        child_note_ids: [],
      },
      "dir-child": {
        id: "dir-child",
        name: "child-dir",
        display_name: "Child Dir",
        parent_dir_ids: ["dir-root"],
        child_dir_ids: [],
        child_note_ids: [],
      },
      "dir-grandchild": {
        id: "dir-grandchild",
        name: "grandchild-dir",
        display_name: "Grandchild Dir",
        parent_dir_ids: ["dir-child"],
        child_dir_ids: [],
        child_note_ids: [],
      },
      "dir-orphan": {
        id: "dir-orphan",
        name: "orphan-dir",
        display_name: "Orphan Dir",
        parent_dir_ids: ["missing-parent"],
        child_dir_ids: [],
        child_note_ids: [],
      },
    };

    // Build hierarchy from directories only.
    const root = new DirectoryHierarchyBuilder(directoryLookup).build(
      "Directories",
    );
    expect(root.getName()).toBe("Directories");

    // Root should contain top-level directory and orphan with unknown parent.
    const rootChildren = root.getChildren();
    expect(rootChildren.map((child) => child.getId())).toEqual([
      "dir-root",
      "dir-orphan",
    ]);

    // Validate nested chain dir-root -> dir-child -> dir-grandchild.
    const dirRoot = rootChildren.find((child) => child.getId() === "dir-root");
    expect(dirRoot).toBeDefined();

    const dirChild = dirRoot
      ?.getChildren()
      .find((child) => child.getId() === "dir-child");
    expect(dirChild).toBeDefined();
    expect(dirChild?.getChildren().map((child) => child.getId())).toEqual([
      "dir-grandchild",
    ]);
  });
});
