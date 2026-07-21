import type { DirectoryReply } from "../api/models/directory";
import type {
  MinimalDirectory,
  MinimalNote,
  MinimalTag,
} from "../api/models/search";

/** A node in the force graph. Coordinates are assigned by the physics sim. */
export interface GraphNode {
  /** Backend object id. */
  id: string;
  /** Label shown for the node. */
  label: string;
  /** Node kind used for styling and navigation. */
  type: "directory" | "note";
  /** Optional tag ids assigned to a note (drives coloring). */
  tags?: string[];
}

/** A directed edge between two nodes. */
export interface GraphLink {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Edge kind used for styling. */
  type: "directory" | "note";
}

/** The graph payload consumed by `react-force-graph-2d`. */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Returns the unique parent directory ids declared by a note. */
export function getNoteParentDirectoryIds(directoryIds?: string[]): string[] {
  return [...new Set(directoryIds ?? [])];
}

/** Returns a human-readable directory label. */
export function getDirectoryLabel(directory: DirectoryReply): string {
  return (
    directory.display_name?.trim() || directory.name || "Untitled Directory"
  );
}

/**
 * Builds the graph payload for the force renderer.
 * Coordinates are intentionally omitted — the physics sim assigns them.
 */
export function buildGraphData(
  directories: DirectoryReply[],
  notes: MinimalNote[],
): GraphData {
  const nodes: GraphNode[] = [
    ...directories.map((directory) => ({
      id: directory.id,
      label: getDirectoryLabel(directory),
      type: "directory" as const,
    })),
    ...notes.map((note) => ({
      id: note.id,
      label: note.title || "Untitled Note",
      type: "note" as const,
      tags: note.tag_ids ?? [],
    })),
  ];

  const links: GraphLink[] = [
    ...directories.flatMap((directory) =>
      (directory.parent_dir_ids ?? []).map((parentId) => ({
        source: parentId,
        target: directory.id,
        type: "directory" as const,
      })),
    ),
    ...notes.flatMap((note) =>
      (note.directory_ids ?? []).map((parentId) => ({
        source: parentId,
        target: note.id,
        type: "note" as const,
      })),
    ),
  ];

  return { nodes, links };
}

/**
 * Performs an undirected BFS from `rootId` for `depth` hops and
 * returns the set of reached node ids (including the root).
 *
 * Tolerates `source`/`target` being either string ids (the shape
 * `buildGraphData` produces) or node-object references (the shape
 * `react-force-graph-2d` mutates the input links into at runtime).
 * Without the coercion, the BFS would silently key the adjacency
 * map by object references and never find any neighbors — so local
 * mode would render only the focal node regardless of `depth`.
 */
export function getNodesWithinDepth(
  rootId: string | null,
  links: GraphLink[],
  depth: number,
): Set<string> {
  if (!rootId || depth <= 0) {
    return new Set();
  }

  const linkEndpointId = (endpoint: GraphLink["source"]): string => {
    if (typeof endpoint === "string") return endpoint;
    if (typeof endpoint === "number") return String(endpoint);
    return (endpoint as { id?: string }).id ?? "";
  };

  const adjacency = new Map<string, string[]>();
  const connect = (a: string, b: string): void => {
    const list = adjacency.get(a) ?? [];
    list.push(b);
    adjacency.set(a, list);
  };
  for (const link of links) {
    const source = linkEndpointId(link.source);
    const target = linkEndpointId(link.target);
    if (!source || !target) continue;
    connect(source, target);
    connect(target, source);
  }

  const visited = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

/** Finds the set of node ids directly connected to `selectedNodeId`. */
export function getConnectedNodeIds(
  selectedNodeId: string | null,
  links: GraphLink[],
): Set<string> | null {
  if (!selectedNodeId) {
    return null;
  }
  const connected = new Set<string>([selectedNodeId]);
  for (const { source, target } of links) {
    if (source === selectedNodeId) {
      connected.add(target);
    }
    if (target === selectedNodeId) {
      connected.add(source);
    }
  }
  return connected;
}

/** Returns the link connecting two nodes (in either direction) or undefined. */
export function findLink(
  links: GraphLink[],
  sourceId: string,
  targetId: string,
): GraphLink | undefined {
  return links.find(
    (link) =>
      (link.source === sourceId && link.target === targetId) ||
      (link.source === targetId && link.target === sourceId),
  );
}

/** Adds a parent directory id to a note if missing. */
export function updateNoteParentLink(
  note: MinimalNote,
  parentDirectoryId: string,
): MinimalNote {
  const currentIds = note.directory_ids ?? [];
  if (currentIds.includes(parentDirectoryId)) {
    return note;
  }
  return {
    ...note,
    directory_ids: [...currentIds, parentDirectoryId],
  };
}

/** Removes a parent directory id from a note. */
export function removeNoteParentLink(
  note: MinimalNote,
  parentDirectoryId: string,
): MinimalNote {
  const nextIds = (note.directory_ids ?? []).filter(
    (id) => id !== parentDirectoryId,
  );
  return { ...note, directory_ids: nextIds };
}

/** A small, deterministic palette indexed by tag id. */
const TAG_PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ef4444", // red
  "#84cc16", // lime
];

/** Returns a stable color for a tag id. */
export function tagColor(tagId: string): string {
  let hash = 0;
  for (let i = 0; i < tagId.length; i++) {
    hash = (hash * 31 + tagId.charCodeAt(i)) | 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

/** Returns a color for the note based on its first tag id. */
export function noteColor(node: GraphNode, fallback: string): string {
  const firstTag = node.tags?.[0];
  return firstTag ? tagColor(firstTag) : fallback;
}

/** Builds a directory label map from a search/NotesReply payload. */
export function buildDirectoryLabels(
  directories: MinimalDirectory[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const directory of directories) {
    map[directory.id] =
      directory.display_name?.trim() || directory.slug || directory.id;
  }
  return map;
}

/** Builds a tag label map from a search/NotesReply payload. */
export function buildTagLabels(tags: MinimalTag[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const tag of tags) {
    map[tag.id] = tag.display_name?.trim() || tag.slug || tag.id;
  }
  return map;
}
