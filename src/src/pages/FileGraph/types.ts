/**
 * Represents a node in the file graph view.
 */
export interface GraphNode {
  /** Backend object id. */
  id: string;
  /** Label shown for the node. */
  label: string;
  /** Node kind used for styling and navigation. */
  type: "directory" | "note";
  /** X coordinate in graph layout space. */
  x: number;
  /** Y coordinate in graph layout space. */
  y: number;
  /** Render radius in pixels. */
  radius: number;
}

/**
 * Represents an edge between two nodes in the file graph view.
 */
export interface GraphEdge {
  /** Unique id combining source/target ids. */
  id: string;
  /** Source node id. */
  sourceId: string;
  /** Target node id. */
  targetId: string;
  /** Edge kind used for styling and deletion behavior. */
  type: "directory" | "note";
}
