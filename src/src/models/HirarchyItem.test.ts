import { describe, expect, it } from "vitest";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../api/models/search";
import {
  DirectoryHierarchyBuilder,
  DirectoryHirarchyItem,
  NoteHierarchyBuilder,
  NoteHirarchyItem,
  RootHirarchyItem,
} from "./HirarchyItem";

/**
 * Convenience factory for permission relationship fixtures.
 *
 * Keeps test setup compact and makes relation/object-type combinations explicit
 * in each test case.
 */
const makePermission = (
  relation: string,
  subjectType: PermissionRelationshipReply["subject"]["object_type"],
  subjectId: string,
): PermissionRelationshipReply => ({
  relation,
  resource: {
    object_id: "note-1",
    object_type: "PERMISSION_OBJECT_TYPE_NOTE",
  },
  subject: {
    object_id: subjectId,
    object_type: subjectType,
  },
});

/**
 * Minimal note fixture tailored for hierarchy tests.
 *
 * Most fields are static because hierarchy behavior only depends on id/title
 * and optional permissions.
 */
const makeNote = (
  id: string,
  title: string,
  permissions?: PermissionRelationshipReply[],
): MinimalNote => ({
  id,
  title,
  author_id: "author",
  updated_at: "2026-01-01T00:00:00Z",
  stripped_content: "preview",
  permissions,
});

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
      parent_id: "root",
    });

    // Case 2: display_name is absent and plain name should be used.
    const withNameFallback = DirectoryHirarchyItem.fromDirectoryReply({
      id: "dir-2",
      name: "notes",
      parent_id: undefined,
    });

    // Wrapped data and resolved identity should remain intact.
    expect(withDisplayName.getId()).toBe("dir-1");
    expect(withDisplayName.getName()).toBe("Engineering");
    expect(withDisplayName.getParent()).toBe("root");
    expect(withDisplayName.getDirectory()).toEqual({
      id: "dir-1",
      name: "engineering",
      display_name: "Engineering",
      parent_id: "root",
    });

    // Name fallback uses raw directory name when display_name is missing.
    expect(withNameFallback.getName()).toBe("notes");
  });

  it("builds note node from permissions and enforces leaf behavior", () => {
    // Should pick the first valid directory-parent relation among mixed relations.
    const noteWithParent = NoteHirarchyItem.fromNoteData(
      makeNote("note-1", "Spec", [
        makePermission("reader", "PERMISSION_OBJECT_TYPE_USER", "user-1"),
        makePermission("parent", "PERMISSION_OBJECT_TYPE_DIRECTORY", "dir-9"),
      ]),
    );

    // Alternate relation key `parent_directory` should be recognized as well.
    const noteWithParentDirectory = NoteHirarchyItem.fromNoteData(
      makeNote("note-2", "Roadmap", [
        makePermission(
          "parent_directory",
          "PERMISSION_OBJECT_TYPE_DIRECTORY",
          "dir-12",
        ),
      ]),
    );

    // Non-directory parent relation should not become hierarchy parent.
    const noteWithoutDirectoryParent = NoteHirarchyItem.fromNoteData(
      makeNote("note-3", "Readme", [
        makePermission("parent", "PERMISSION_OBJECT_TYPE_USER", "user-2"),
      ]),
    );

    // Parent extraction behavior.
    expect(noteWithParent.getParent()).toBe("dir-9");
    expect(noteWithParentDirectory.getParent()).toBe("dir-12");
    expect(noteWithoutDirectoryParent.getParent()).toBeUndefined();

    // Leaf identity and iteration behavior.
    expect(noteWithParent.getName()).toBe("Spec");
    expect(noteWithParent.getNoteId()).toBe("note-1");
    expect(noteWithParent.getChildren()).toEqual([]);
    expect([...noteWithParent]).toEqual([]);

    // Leaf node contract must reject adding children.
    expect(() => noteWithParent.addChild(noteWithParentDirectory)).toThrow(
      "Leaf nodes cannot add children.",
    );
    // Removing children from leaf should be a no-op.
    expect(noteWithParent.removeChild("child")).toBe(false);
  });

  it("groups notes by directory and keeps unparented notes at root", () => {
    // Build mixed dataset: root-level notes, two directory buckets, and one
    // invalid parent relation that should remain at root.
    const notes: MinimalNote[] = [
      makeNote("n1", "Standalone"),
      makeNote("n2", "In A", [
        makePermission("parent", "PERMISSION_OBJECT_TYPE_DIRECTORY", "dir-a"),
      ]),
      makeNote("n3", "Also In A", [
        makePermission(
          "parent_directory",
          "PERMISSION_OBJECT_TYPE_DIRECTORY",
          "dir-a",
        ),
      ]),
      makeNote("n4", "In B", [
        makePermission("parent", "PERMISSION_OBJECT_TYPE_DIRECTORY", "dir-b"),
      ]),
      makeNote("n5", "Parent Is Not Directory", [
        makePermission("parent", "PERMISSION_OBJECT_TYPE_USER", "user-9"),
      ]),
    ];

    // Build final hierarchy tree from note list.
    const root = new NoteHierarchyBuilder(notes).build("Workspace");

    expect(root.getName()).toBe("Workspace");

    // Root should contain: n1, n5, dir-a, dir-b (order from insertion flow).
    const rootChildren = root.getChildren();
    expect(rootChildren).toHaveLength(4);

    // Lookup by id to make assertions order-independent for readability.
    const standalone = rootChildren.find((item) => item.getId() === "n1");
    const nonDirectoryParent = rootChildren.find(
      (item) => item.getId() === "n5",
    );
    const dirA = rootChildren.find((item) => item.getId() === "dir-a");
    const dirB = rootChildren.find((item) => item.getId() === "dir-b");

    // Notes without valid directory parent stay at root level.
    expect(standalone?.getName()).toBe("Standalone");
    expect(nonDirectoryParent?.getName()).toBe("Parent Is Not Directory");

    // Synthetic directory nodes should have been created.
    expect(dirA).toBeDefined();
    expect(dirB).toBeDefined();

    // Synthetic directory naming currently mirrors the directory id.
    expect(dirA?.getName()).toBe("dir-a");
    // Synthetic directories are attached directly under root in this builder.
    expect(dirA?.getParent()).toBeUndefined();
    // Directory A should contain the two notes mapped to dir-a.
    expect(dirA?.getChildren().map((child) => child.getId())).toEqual([
      "n2",
      "n3",
    ]);

    // Directory B should contain only its one mapped note.
    expect(dirB?.getChildren().map((child) => child.getId())).toEqual(["n4"]);
  });

  it("builds directory hierarchy from directory lookup only", () => {
    // Build mixed directory map with nested, missing-parent, and root-level items.
    const directoryLookup = {
      "dir-root": {
        id: "dir-root",
        name: "root-dir",
        display_name: "Root Dir",
      },
      "dir-child": {
        id: "dir-child",
        name: "child-dir",
        display_name: "Child Dir",
        parent_id: "dir-root",
      },
      "dir-grandchild": {
        id: "dir-grandchild",
        name: "grandchild-dir",
        display_name: "Grandchild Dir",
        parent_id: "dir-child",
      },
      "dir-orphan": {
        id: "dir-orphan",
        name: "orphan-dir",
        display_name: "Orphan Dir",
        parent_id: "missing-parent",
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
