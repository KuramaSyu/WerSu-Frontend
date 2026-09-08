import type { PermissionRelationshipReply } from "./search";

export interface DirectoryReply {
  id: string;
  slug?: string;
  name?: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_dir_ids: string[];
  child_dir_ids: string[];
  child_note_ids: string[];
  /** Shelves this directory sits on; filled when include_shelves=true. */
  shelf_ids: string[];
  relationships?: PermissionRelationshipReply[];
}

export interface CreateDirectoryBody {
  name: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_ids?: string[];
  /** Shelves the new directory should be bound to. */
  shelf_ids?: string[];
}

export interface PatchDirectoryBody {
  id: string;
  name?: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_ids?: string[];
  /** Shelves the directory should be bound to. */
  shelf_ids?: string[];
}
