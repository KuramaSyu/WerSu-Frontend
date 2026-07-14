import { describe, expect, it } from "vitest";
import type { MinimalNote } from "../api/models/search";
import type { DirectoryReply } from "../api/models/directory";
import {
  buildGraphLayout,
  getConnectedNodeIds,
  getDirectoryLabel,
  getNoteParentDirectoryIds,
  removeNoteParentLink,
  updateNoteParentLink,
} from "./fileGraphUtils";

function makeNote(directoryIds?: string[]): MinimalNote {
  return {
    id: "note-1",
    title: "Note",
    author_id: "user-1",
    updated_at: new Date().toISOString(),
    stripped_content: "",
    directory_ids: directoryIds ?? [],
    tag_ids: [],
  };
}

function makeDirectory(id: string, parentIds: string[] = []): DirectoryReply {
  return {
    id,
    name: id,
    parent_dir_ids: parentIds,
    child_dir_ids: [],
    child_note_ids: [],
  };
}

describe("fileGraphUtils", () => {
  it("returns parent directory ids from directory_ids", () => {
    expect(getNoteParentDirectoryIds(["dir-1", "dir-2"])).toEqual([
      "dir-1",
      "dir-2",
    ]);
  });

  it("deduplicates repeated directory ids", () => {
    expect(getNoteParentDirectoryIds(["dir-1", "dir-1"])).toEqual(["dir-1"]);
  });

  it("returns an empty array when directory_ids is missing", () => {
    expect(getNoteParentDirectoryIds(undefined)).toEqual([]);
  });

  it("uses display name when building directory labels", () => {
    const directory: DirectoryReply = {
      id: "dir-1",
      name: "fallback",
      display_name: " Display ",
      parent_dir_ids: [],
      child_dir_ids: [],
      child_note_ids: [],
    };
    expect(getDirectoryLabel(directory)).toBe("Display");
  });

  it("builds graph layout nodes and edges", () => {
    const directories = [
      makeDirectory("dir-1"),
      makeDirectory("dir-2", ["dir-1"]),
    ];
    const notes = [makeNote(["dir-1"])];
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
    expect(getNoteParentDirectoryIds(updated.directory_ids)).toEqual(["dir-9"]);

    const removed = removeNoteParentLink(updated, "dir-9");
    expect(getNoteParentDirectoryIds(removed.directory_ids)).toEqual([]);
  });
});
