import { describe, expect, it } from "vitest";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../api/models/search";
import type { DirectoryReply } from "../api/models/directory";
import {
  buildGraphLayout,
  getConnectedNodeIds,
  getDirectoryLabel,
  getNoteParentDirectoryIds,
  removeNoteParentLink,
  updateNoteParentLink,
} from "./fileGraphUtils";

function makePermission(directoryId: string): PermissionRelationshipReply {
  return {
    relation: "parent_directory",
    resource: {
      object_id: "note-1",
      object_type: "PERMISSION_OBJECT_TYPE_NOTE",
    },
    subject: {
      object_id: directoryId,
      object_type: "PERMISSION_OBJECT_TYPE_DIRECTORY",
    },
  };
}

function makeNote(permissions?: PermissionRelationshipReply[]): MinimalNote {
  return {
    id: "note-1",
    title: "Note",
    author_id: "user-1",
    updated_at: new Date().toISOString(),
    stripped_content: "",
    permissions,
  };
}

function makeDirectory(id: string, parentId?: string | null): DirectoryReply {
  return {
    id,
    name: id,
    parent_id: parentId,
  };
}

describe("fileGraphUtils", () => {
  it("gets parent directory ids from permissions", () => {
    const permissions = [makePermission("dir-1"), makePermission("dir-2")];
    expect(getNoteParentDirectoryIds(permissions)).toEqual(["dir-1", "dir-2"]);
  });

  it("uses display name when building directory labels", () => {
    const directory: DirectoryReply = {
      id: "dir-1",
      name: "fallback",
      display_name: " Display ",
    };
    expect(getDirectoryLabel(directory)).toBe("Display");
  });

  it("builds graph layout nodes and edges", () => {
    const directories = [
      makeDirectory("dir-1"),
      makeDirectory("dir-2", "dir-1"),
    ];
    const notes = [makeNote([makePermission("dir-1")])];
    const { nodes, edges } = buildGraphLayout(directories, notes, {
      width: 800,
      height: 600,
    });

    expect(nodes.size).toBe(3);
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: "dir-1", targetId: "dir-2" }),
        expect.objectContaining({ sourceId: "dir-1", targetId: "note-1" }),
      ]),
    );
  });

  it("tracks connected node ids", () => {
    const connected = getConnectedNodeIds("a", [
      { id: "e1", sourceId: "a", targetId: "b", type: "note" },
      { id: "e2", sourceId: "c", targetId: "a", type: "directory" },
    ]);

    expect(connected).toEqual(new Set(["a", "b", "c"]));
  });

  it("adds and removes note parent links", () => {
    const note = makeNote();
    const updated = updateNoteParentLink(note, "dir-9");
    expect(getNoteParentDirectoryIds(updated.permissions)).toEqual(["dir-9"]);

    const removed = removeNoteParentLink(updated, "dir-9");
    expect(getNoteParentDirectoryIds(removed.permissions)).toEqual([]);
  });
});
