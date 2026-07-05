import type { PermissionRelationshipReply } from "./search";

export interface DirectoryReply {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_id?: string | null;
  // Snapshot of the directory's `README.md` note. Returned directly on the
  // directory reply so the editor doesn't need a second roundtrip. `readme_id`
  // is the linked note's id, or `null` if no README has been created yet.
  readme_id?: string | null;
  readme_content?: string;
  relationships?: PermissionRelationshipReply[];
}

export interface CreateDirectoryBody {
  name: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_id?: string | null;
}

export interface PatchDirectoryBody {
  id: string;
  name?: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_id?: string | null;
}
