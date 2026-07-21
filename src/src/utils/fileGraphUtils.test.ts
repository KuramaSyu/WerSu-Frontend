import { describe, expect, it } from "vitest";
import type { DirectoryReply } from "../api/models/directory";
import type { MinimalNote } from "../api/models/search";
import {
  buildGraphData,
  buildDirectoryLabels,
  buildTagLabels,
  findLink,
  getConnectedNodeIds,
  getDirectoryLabel,
  getNodesWithinDepth,
  getNoteParentDirectoryIds,
  noteColor,
  removeNoteParentLink,
  tagColor,
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

describe("getNoteParentDirectoryIds", () => {
  it("returns parent directory ids", () => {
    expect(getNoteParentDirectoryIds(["dir-1", "dir-2"])).toEqual([
      "dir-1",
      "dir-2",
    ]);
  });

  it("deduplicates repeated ids", () => {
    expect(getNoteParentDirectoryIds(["dir-1", "dir-1"])).toEqual(["dir-1"]);
  });

  it("returns empty array when missing", () => {
    expect(getNoteParentDirectoryIds(undefined)).toEqual([]);
  });
});

describe("getDirectoryLabel", () => {
  it("prefers display name", () => {
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
});

describe("buildGraphData", () => {
  it("creates nodes + links with no coordinates", () => {
    const { nodes, links } = buildGraphData(
      [makeDirectory("dir-1"), makeDirectory("dir-2", ["dir-1"])],
      [makeNote(["dir-1"])],
    );

    expect(nodes).toHaveLength(3);
    expect(nodes.find((n) => n.id === "dir-1")?.type).toBe("directory");
    expect(nodes.find((n) => n.id === "note-1")?.type).toBe("note");
    expect(nodes.find((n) => n.id === "note-1")?.tags).toEqual([]);

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "dir-1",
          target: "dir-2",
          type: "directory",
        }),
        expect.objectContaining({
          source: "dir-1",
          target: "note-1",
          type: "note",
        }),
      ]),
    );
  });
});

describe("getNodesWithinDepth", () => {
  const links = [
    { source: "a", target: "b", type: "directory" as const },
    { source: "b", target: "c", type: "directory" as const },
    { source: "c", target: "d", type: "note" as const },
    { source: "x", target: "y", type: "note" as const },
  ];

  it("returns just the root at depth 0", () => {
    expect(getNodesWithinDepth("a", links, 0)).toEqual(new Set(["a"]));
  });

  it("expands one hop", () => {
    expect(getNodesWithinDepth("a", links, 1)).toEqual(new Set(["a", "b"]));
  });

  it("expands two hops including direction-agnostic neighbors", () => {
    expect(getNodesWithinDepth("a", links, 3)).toEqual(
      new Set(["a", "b", "c", "d"]),
    );
  });

  it("returns empty for null root", () => {
    expect(getNodesWithinDepth(null, links, 3)).toEqual(new Set());
  });
});

describe("getConnectedNodeIds", () => {
  it("collects neighbors in either direction", () => {
    expect(
      getConnectedNodeIds("a", [
        { source: "a", target: "b", type: "note" },
        { source: "c", target: "a", type: "directory" },
      ]),
    ).toEqual(new Set(["a", "b", "c"]));
  });

  it("returns null when no selection", () => {
    expect(
      getConnectedNodeIds(null, [{ source: "a", target: "b", type: "note" }]),
    ).toBeNull();
  });
});

describe("findLink", () => {
  const links = [
    { source: "a", target: "b", type: "directory" as const },
    { source: "c", target: "d", type: "note" as const },
  ];

  it("matches in either direction", () => {
    expect(findLink(links, "b", "a")).toBeDefined();
    expect(findLink(links, "c", "d")).toBeDefined();
  });

  it("returns undefined when missing", () => {
    expect(findLink(links, "a", "c")).toBeUndefined();
  });
});

describe("parent-link helpers", () => {
  it("adds a parent directory id", () => {
    expect(updateNoteParentLink(makeNote(), "dir-9").directory_ids).toEqual([
      "dir-9",
    ]);
  });

  it("does not duplicate an existing parent id", () => {
    expect(
      updateNoteParentLink(makeNote(["dir-9"]), "dir-9").directory_ids,
    ).toEqual(["dir-9"]);
  });

  it("removes a parent directory id", () => {
    expect(
      removeNoteParentLink(makeNote(["dir-9"]), "dir-9").directory_ids,
    ).toEqual([]);
  });
});

describe("tagColor / noteColor", () => {
  it("returns a stable palette color per tag id", () => {
    const a = tagColor("tag-1");
    const b = tagColor("tag-1");
    const c = tagColor("totally-different");
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("uses first tag color for a node", () => {
    const node = {
      id: "n",
      label: "n",
      type: "note" as const,
      tags: ["tag-1"],
    };
    expect(noteColor(node, "#000")).toBe(tagColor("tag-1"));
    const untagged = { id: "n", label: "n", type: "note" as const };
    expect(noteColor(untagged, "#000")).toBe("#000");
  });
});

describe("label maps", () => {
  it("builds directory labels with display-name fallback", () => {
    expect(
      buildDirectoryLabels([
        { id: "d1", display_name: "Inbox" },
        { id: "d2", slug: "drafts" },
        { id: "d3" },
      ]),
    ).toEqual({ d1: "Inbox", d2: "drafts", d3: "d3" });
  });

  it("builds tag labels with display-name fallback", () => {
    expect(
      buildTagLabels([
        { id: "t1", display_name: "Work" },
        { id: "t2", slug: "ideas" },
        { id: "t3" },
      ]),
    ).toEqual({ t1: "Work", t2: "ideas", t3: "t3" });
  });
});
