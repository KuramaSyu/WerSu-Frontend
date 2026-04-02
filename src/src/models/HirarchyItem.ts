import type { DirectoryReply } from "../api/models/directory";
import type {
  MinimalNote,
  NoteData,
  PermissionRelationshipReply,
} from "../api/models/search";

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

/**
 * Composite node that wraps a directory API model.
 *
 * Directory nodes can contain both child directories and notes.
 */
export class DirectoryHirarchyItem extends CompositeHirarchyItem {
  /** Creates a hierarchy node from directory model data. */
  constructor(
    private readonly directory: Pick<
      // Only include fields which are relevant
      DirectoryReply,
      "id" | "name" | "display_name" | "parent_id"
    >,
  ) {
    super(
      directory.id,
      directory.display_name ?? directory.name,
      directory.parent_id,
    );
  }

  /** Factory helper for creating a hierarchy node from a full directory reply. */
  static fromDirectoryReply(directory: DirectoryReply): DirectoryHirarchyItem {
    return new DirectoryHirarchyItem(directory);
  }

  /** Returns the wrapped directory model used to create this node. */
  getDirectory(): Pick<
    DirectoryReply,
    "id" | "name" | "display_name" | "parent_id"
  > {
    return this.directory;
  }
}

/**
 * Extracts the parent directory id from note permissions.
 *
 * Notes encode directory placement as permission relationships (`parent` or
 * `parent_directory`) targeting a directory subject.
 */
const findNoteParentDirectory = (
  permissions?: PermissionRelationshipReply[],
): string | undefined => {
  if (!permissions) {
    return undefined;
  }

  for (const permission of permissions) {
    const isParentRelation =
      permission.relation === "parent" ||
      permission.relation === "parent_directory";
    const isDirectory =
      permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY";

    if (isParentRelation && isDirectory) {
      return permission.subject.object_id;
    }
  }

  return undefined;
};

/**
 * Leaf hierarchy node that wraps a note model.
 *
 * Notes cannot contain child nodes.
 */
export class NoteHirarchyItem extends BaseHirarchyItem {
  private readonly noteId: string;
  private readonly title: string;

  /** Creates a note node with an optional parent directory id. */
  constructor(id: string, title: string, parentId?: string) {
    super(id, parentId);
    this.noteId = id;
    this.title = title;
  }

  /**
   * Factory helper for constructing a note node from supported note models.
   * Parent directory is resolved from permission relationships when present.
   */
  static fromNoteData(note: MinimalNote | NoteData): NoteHirarchyItem {
    return new NoteHirarchyItem(
      note.id,
      note.title,
      findNoteParentDirectory(note.permissions),
    );
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
}

/**
 * Builds a hierarchy tree from notes that include permission relationships.
 *
 * Since notes only expose the target directory id via permissions, this builder
 * creates synthetic directory nodes (id + name=id) when necessary and attaches
 * them directly under the root.
 */
export class NoteHierarchyBuilder {
  private readonly notes: Array<MinimalNote | NoteData>;

  constructor(notes: Array<MinimalNote | NoteData>) {
    this.notes = notes;
  }

  /**
   * Creates a hierarchy rooted at `RootHirarchyItem` and groups notes by their
   * parent directory relation (`parent` / `parent_directory`) when available.
   */
  build(rootName = "Root"): RootHirarchyItem {
    const root = new RootHirarchyItem(rootName);
    const directoryNodes = new Map<string, DirectoryHirarchyItem>();

    for (const note of this.notes) {
      const noteNode = NoteHirarchyItem.fromNoteData(note);
      const parentDirectoryId = noteNode.getParent();

      if (!parentDirectoryId) {
        root.addChild(noteNode);
        continue;
      }

      let parentDirectoryNode = directoryNodes.get(parentDirectoryId);

      if (!parentDirectoryNode) {
        parentDirectoryNode = new DirectoryHirarchyItem({
          id: parentDirectoryId,
          name: parentDirectoryId,
          display_name: parentDirectoryId,
          parent_id: undefined,
        });
        directoryNodes.set(parentDirectoryId, parentDirectoryNode);
        root.addChild(parentDirectoryNode);
      }

      parentDirectoryNode.addChild(noteNode);
    }

    return root;
  }
}
