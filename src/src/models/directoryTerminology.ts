import type { DirectoryReply } from "../api/models/directory";
import type { HirarchyItem } from "./HirarchyItem";

/**
 * User-facing vocabulary for the directory hierarchy.
 *
 * The same backend entity ("directory") plays two roles in the UI:
 * - a **Book** is an upper-level directory of a shelf (a directory
 *   with no parent directory), and
 * - a **Chapter** is any directory nested below one.
 *
 * Keep every user-visible label flowing through this module so the two
 * names stay consistent across the app.
 */
export type DirectoryKind = "book" | "chapter";

export interface DirectoryTerms {
  /** Title-case singular, e.g. "Book". */
  singular: string;
  /** Title-case plural, e.g. "Books". */
  plural: string;
  /** Lower-case singular for sentences, e.g. "book". */
  singularLower: string;
  /** Lower-case plural for sentences, e.g. "books". */
  pluralLower: string;
}

const TERMS: Record<DirectoryKind, DirectoryTerms> = {
  book: {
    singular: "Book",
    plural: "Books",
    singularLower: "book",
    pluralLower: "books",
  },
  chapter: {
    singular: "Chapter",
    plural: "Chapters",
    singularLower: "chapter",
    pluralLower: "chapters",
  },
};

/** Returns the label set for a single kind. */
export function directoryTerms(kind: DirectoryKind): DirectoryTerms {
  return TERMS[kind];
}

/**
 * Book when the directory has no parent directory, Chapter otherwise.
 * Used for directory reply / form payload shapes.
 */
export function directoryKindOf(
  directory: Pick<DirectoryReply, "parent_dir_ids">,
): DirectoryKind {
  return (directory.parent_dir_ids?.length ?? 0) === 0 ? "book" : "chapter";
}

/**
 * Book when the node has no parent directory, Chapter otherwise.
 * The synthetic root / shelf roots have no parent, so they count as
 * books here, which matches how their direct children render on Home.
 */
export function directoryKindOfNode(node: HirarchyItem): DirectoryKind {
  return node.getParent() === undefined ? "book" : "chapter";
}

/** Book when no parent directory id is supplied, Chapter otherwise. */
export function directoryKindOfParentId(
  parentId: string | undefined | null,
): DirectoryKind {
  return parentId ? "chapter" : "book";
}
