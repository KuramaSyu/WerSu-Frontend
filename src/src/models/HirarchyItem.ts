import type { DirectoryReply } from "../api/models/directory";
import type { MinimalNote, NoteData } from "../api/models/search";

/**
 * Common contract for all hierarchy nodes.
 *
 * The hierarchy uses a composite model where both branch nodes (root/directories)
 * and leaf nodes (notes) are handled through the same interface.
 */
export interface HirarchyItem extends Iterable<HirarchyItem> {
  /** Returns the unique node identifier. */
  getId(): string;

  /** Returns the display name used for rendering this node. */
  getName(): string;

  /**
   * Returns the parent node id.
   *
   * `undefined` indicates a top-level node (for example the root node).
   */
  getParent(): string | undefined;

  /**
   * Adds a child node.
   *
   * Leaf nodes are allowed to throw when this method is called.
   */
  addChild(child: HirarchyItem): void;

  /** Removes a child by id and returns whether a node was removed. */
  removeChild(childId: string): boolean;

  /** Returns direct children of this node in insertion order. */
  getChildren(): HirarchyItem[];

  /** Returns an iterator over direct children of this node. */
  [Symbol.iterator](): IterableIterator<HirarchyItem>;
}

/**
 * Shared implementation for common hierarchy node behavior.
 *
 * This base class stores immutable id/parent references.
 * Child management is intentionally abstract so each concrete subtype can
 * define explicit composite or leaf behavior.
 */
abstract class BaseHirarchyItem implements HirarchyItem {
  private readonly id: string;
  private readonly parentId?: string;

  protected constructor(id: string, parentId?: string) {
    this.id = id;
    this.parentId = parentId;
  }

  getId(): string {
    return this.id;
  }

  getParent(): string | undefined {
    return this.parentId;
  }

  abstract getName(): string;
  abstract addChild(child: HirarchyItem): void;
  abstract removeChild(childId: string): boolean;
  abstract getChildren(): HirarchyItem[];

  *[Symbol.iterator](): IterableIterator<HirarchyItem> {
    for (const child of this.getChildren()) {
      yield child;
    }
  }
}

/**
 * Generic composite node implementation.
 *
 * Children are indexed by id in a map to make child replacement/removal stable
 * and efficient.
 */
class CompositeHirarchyItem extends BaseHirarchyItem {
  private readonly children = new Map<string, HirarchyItem>();
  private readonly name: string;

  constructor(id: string, name: string, parentId?: string) {
    super(id, parentId);
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  addChild(child: HirarchyItem): void {
    this.children.set(child.getId(), child);
  }

  removeChild(childId: string): boolean {
    return this.children.delete(childId);
  }

  getChildren(): HirarchyItem[] {
    return [...this.children.values()];
  }
}

/**
 * Root hierarchy node.
 *
 * Serves as the single top-level entry point for the full tree.
 */
export class RootHirarchyItem extends CompositeHirarchyItem {
  /** Creates the root node with a fixed id (`root`) and a customizable label. */
  constructor(name = "Root") {
    super("root", name);
  }
}

/** Top-level container that becomes the root when a shelf is picked from ShelfMenu. */
export class ShelfHirarchyItem extends CompositeHirarchyItem {
  constructor(id: string, name: string) {
    super(id, name);
  }
}

/** Return type of DirectoryHierarchyBuilder.build: legacy root or shelf-scoped root. */
export type DirectoryHierarchyRoot = RootHirarchyItem | ShelfHirarchyItem;

/**
 * Composite node that wraps a directory API model.
 *
 * Directory nodes can contain both child directories and notes. The
 * `parent_dir_ids` array on `DirectoryReply` makes a directory
 * multi-parent (the previous single `parent_id` field is gone); the
 * hierarchy treats the first id as the canonical parent for breadcrumb
 * rendering and falls back to root when the array is empty.
 */
export class DirectoryHirarchyItem extends CompositeHirarchyItem {
  /** Creates a hierarchy node from directory model data. */
  constructor(
    private readonly directory: Pick<
      DirectoryReply,
      | "id"
      | "name"
      | "display_name"
      | "slug"
      | "parent_dir_ids"
      | "child_dir_ids"
      | "child_note_ids"
      | "shelf_ids"
    >,
  ) {
    super(
      directory.id,
      directory.display_name ??
        directory.name ??
        directory.slug ??
        directory.id,
      directory.parent_dir_ids?.[0],
    );
  }

  /** Factory helper for creating a hierarchy node from a full directory reply. */
  static fromDirectoryReply(directory: DirectoryReply): DirectoryHirarchyItem {
    return new DirectoryHirarchyItem(directory);
  }

  /** Returns the wrapped directory model used to create this node. */
  getDirectory(): Pick<
    DirectoryReply,
    | "id"
    | "name"
    | "display_name"
    | "slug"
    | "parent_dir_ids"
    | "child_dir_ids"
    | "child_note_ids"
    | "shelf_ids"
  > {
    return this.directory;
  }

  /** Returns every parent directory id declared by the backend. */
  getParentDirectoryIds(): string[] {
    return [...(this.directory.parent_dir_ids ?? [])];
  }
}

/**
 * Leaf hierarchy node that wraps a note model.
 *
 * Notes cannot contain child nodes and live under every parent they
 * declare via `directory_ids`. The hierarchy exposes the full list
 * through `getParentDirectoryIds()`; `getParent()` (inherited from the
 * base contract) keeps returning the first parent for backwards
 * compatibility with single-parent code paths.
 */
export class NoteHirarchyItem extends BaseHirarchyItem {
  private readonly noteId: string;
  private readonly title: string;
  private readonly parentDirectoryIds: string[];

  /** Creates a note node with an optional parent directory id. */
  constructor(id: string, title: string, parentDirectoryIds: string[] = []) {
    super(id, parentDirectoryIds[0]);
    this.noteId = id;
    this.title = title;
    this.parentDirectoryIds = [...new Set(parentDirectoryIds)];
  }

  /**
   * Factory helper for constructing a note node from supported note models.
   * Parent directories are resolved from `directory_ids` (the new wire
   * field). Empty array = unparented (root) note.
   */
  static fromNoteData(note: MinimalNote | NoteData): NoteHirarchyItem {
    return new NoteHirarchyItem(note.id, note.title, note.directory_ids ?? []);
  }

  /** Returns the note title used as display label in the hierarchy. */
  getName(): string {
    return this.title;
  }

  /** Leaf nodes cannot own children. */
  addChild(_child: HirarchyItem): void {
    throw new Error("Leaf nodes cannot add children.");
  }

  /** Leaf nodes never contain children to remove. */
  removeChild(_childId: string): boolean {
    return false;
  }

  /** Leaf nodes always return an empty children collection. */
  getChildren(): HirarchyItem[] {
    return [];
  }

  /** Returns the underlying note id (same value as `getId()`). */
  getNoteId(): string {
    return this.noteId;
  }

  /** Returns the deduplicated list of parent directory ids. */
  getParentDirectoryIds(): string[] {
    return [...this.parentDirectoryIds];
  }
}

/**
 * Builds a hierarchy tree from notes that declare `directory_ids`.
 *
 * Each note is attached under every directory id it lists; notes with
 * no parents land directly under the root. Missing parent directories
 * become synthetic nodes so the tree is still a valid hierarchy.
 */
export class NoteHierarchyBuilder {
  private readonly notes: Array<MinimalNote | NoteData>;

  constructor(notes: Array<MinimalNote | NoteData>) {
    this.notes = notes;
  }

  /**
   * Creates a hierarchy rooted at `RootHirarchyItem` and groups notes by
   * the directory ids in `note.directory_ids`.
   */
  build(
    rootName = "Root",
    directoryLookup: Record<string, DirectoryReply> | null = null,
  ): RootHirarchyItem {
    const root = new RootHirarchyItem(rootName);
    const directoryNodes = new Map<string, DirectoryHirarchyItem>();

    /**
     * Helper lookup by id function. Construct a directory node from the
     * lookup map, or create a synthetic one with only the id.
     */
    const getDirectoryNode = (id: string): DirectoryHirarchyItem => {
      if (directoryLookup && directoryLookup[id]) {
        return DirectoryHirarchyItem.fromDirectoryReply(directoryLookup[id]);
      }
      return new DirectoryHirarchyItem({
        id,
        name: id,
        display_name: id,
        parent_dir_ids: [],
        child_dir_ids: [],
        child_note_ids: [],
        shelf_ids: [],
      });
    };

    // Iterate over all notes.
    for (const note of this.notes) {
      const noteNode = NoteHirarchyItem.fromNoteData(note);
      const parentDirectoryIds = noteNode.getParentDirectoryIds();

      // Unparented notes attach directly to the root.
      if (parentDirectoryIds.length === 0) {
        root.addChild(noteNode);
        continue;
      }

      for (const parentDirectoryId of parentDirectoryIds) {
        // Cache directory nodes so we don't allocate fresh ones per note.
        let parentDirectoryNode = directoryNodes.get(parentDirectoryId);
        if (!parentDirectoryNode) {
          parentDirectoryNode = getDirectoryNode(parentDirectoryId);
          directoryNodes.set(parentDirectoryId, parentDirectoryNode);
          root.addChild(parentDirectoryNode);
        }
        parentDirectoryNode.addChild(noteNode);
      }
    }

    return root;
  }
}

/** Options for DirectoryHierarchyBuilder.build. */
export interface DirectoryHierarchyBuildOptions {
  /** Shelf id to scope the build to; the root becomes a ShelfHirarchyItem when set. */
  shelfId?: string | null;
  /** Display name forwarded to the constructed root. */
  rootName?: string;
  /** Notes attached to on-shelf directories; unparented notes land at the shelf root. */
  attachedNotes?: ReadonlyArray<import("../api/models/search").MinimalNote>;
}

/**
 * Builds a hierarchy tree from directories only.
 *
 * Directories are attached to their parent when `parent_dir_ids` lists
 * another directory present in the lookup map. The first id in the list
 * is treated as the canonical parent for tree placement. Directories
 * with missing parents are attached directly to the root.
 */
export class DirectoryHierarchyBuilder {
  private readonly directoryLookup: Record<string, DirectoryReply>;

  constructor(directoryLookup: Record<string, DirectoryReply>) {
    this.directoryLookup = directoryLookup;
  }

  /**
   * Builds a hierarchy. Pass options.shelfId to switch the root to a
   * ShelfHirarchyItem scoped to that shelf.
   */
  build(
    rootName: string = "Root",
    options: DirectoryHierarchyBuildOptions = {},
  ): DirectoryHierarchyRoot {
    const shelfId = options.shelfId ?? null;
    const attachedNotes = options.attachedNotes ?? [];

    const root = createRoot(shelfId, rootName);
    const directoryNodes = buildDirectoryNodes(this.directoryLookup);
    attachDirectoriesToTree(root, directoryNodes);

    if (shelfId !== null) {
      applyShelfScope(root, directoryNodes, attachedNotes, shelfId);
    }

    return root;
  }
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/** Picks the right root type: ShelfHirarchyItem when scoped, otherwise Root. */
const createRoot = (
  shelfId: string | null,
  rootName: string,
): DirectoryHierarchyRoot =>
  shelfId !== null
    ? new ShelfHirarchyItem(shelfId, rootName)
    : new RootHirarchyItem(rootName);

/** Converts every `DirectoryReply` into a `DirectoryHirarchyItem` keyed by id. */
const buildDirectoryNodes = (
  lookup: Record<string, DirectoryReply>,
): Map<string, DirectoryHirarchyItem> => {
  const nodes = new Map<string, DirectoryHirarchyItem>();
  for (const directory of Object.values(lookup)) {
    nodes.set(directory.id, DirectoryHirarchyItem.fromDirectoryReply(directory));
  }
  return nodes;
};

/**
 * Attaches each directory node under its declared parent. Falls back
 * to the root when the parent is missing or self-referential.
 */
const attachDirectoriesToTree = (
  root: HirarchyItem,
  directoryNodes: Map<string, DirectoryHirarchyItem>,
): void => {
  for (const node of directoryNodes.values()) {
    const parentId = node.getParent();
    if (!parentId || parentId === node.getId()) {
      root.addChild(node);
      continue;
    }
    const parent = directoryNodes.get(parentId);
    if (!parent) {
      root.addChild(node);
      continue;
    }
    parent.addChild(node);
  }
};

/**
 * Shelf-scoped build: drop non-shelf branches and attach notes
 * under their deepest surviving directory. Composed of three small
 * passes so the high-level intent reads top-to-bottom.
 */
const applyShelfScope = (
  root: HirarchyItem,
  directoryNodes: Map<string, DirectoryHirarchyItem>,
  attachedNotes: ReadonlyArray<import("../api/models/search").MinimalNote>,
  shelfId: string,
): void => {
  const onShelf = collectOnShelfDirectories(root, shelfId);
  stripNonShelfDirectories(root, onShelf);
  attachNotesOnShelf(root, directoryNodes, attachedNotes, onShelf);
};

/**
 * Top-down pass that flags every directory as on-shelf when it or
 * any ancestor lists the shelf id. Descendants inherit so a
 * subdirectory of a shelf member stays even when it doesn't list
 * the shelf itself.
 */
const collectOnShelfDirectories = (
  root: HirarchyItem,
  shelfId: string,
): Set<string> => {
  const onShelf = new Set<string>();
  const walk = (node: HirarchyItem, ancestorOnShelf: boolean): void => {
    if (node instanceof NoteHirarchyItem) {
      return;
    }
    if (node instanceof DirectoryHirarchyItem) {
      const direct = (node.getDirectory().shelf_ids ?? []).includes(shelfId);
      const here = direct || ancestorOnShelf;
      if (here) {
        onShelf.add(node.getId());
      }
      for (const child of node.getChildren()) {
        walk(child, here);
      }
      return;
    }
    // Root / ShelfHirarchyItem: propagate the flag unchanged.
    for (const child of node.getChildren()) {
      walk(child, ancestorOnShelf);
    }
  };
  for (const child of root.getChildren()) {
    walk(child, false);
  }
  return onShelf;
};

/** Removes every directory branch that isn't on the shelf. */
const stripNonShelfDirectories = (
  root: HirarchyItem,
  onShelf: Set<string>,
): void => {
  const strip = (node: HirarchyItem): void => {
    for (const child of [...node.getChildren()]) {
      if (child instanceof DirectoryHirarchyItem && !onShelf.has(child.getId())) {
        node.removeChild(child.getId());
        continue;
      }
      strip(child);
    }
  };
  strip(root);
};

/**
 * Attaches each note under the deepest on-shelf parent directory
 * declared in `parent_ids`. Unparented notes (or notes whose parents
 * were all stripped) land directly under the root.
 */
const attachNotesOnShelf = (
  root: HirarchyItem,
  directoryNodes: Map<string, DirectoryHirarchyItem>,
  attachedNotes: ReadonlyArray<import("../api/models/search").MinimalNote>,
  onShelf: Set<string>,
): void => {
  for (const note of attachedNotes) {
    const noteNode = NoteHirarchyItem.fromNoteData(note);
    const parents = noteNode
      .getParentDirectoryIds()
      .filter((id) => onShelf.has(id));
    if (parents.length === 0) {
      root.addChild(noteNode);
      continue;
    }
    for (const parentId of parents) {
      const parentNode = directoryNodes.get(parentId);
      if (parentNode) {
        parentNode.addChild(noteNode);
      }
    }
  }
};
