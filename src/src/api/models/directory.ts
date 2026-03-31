import type { PermissionRelationshipReply } from "./search";

export interface DirectoryReply {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  relationships?: PermissionRelationshipReply[];
}

export interface CreateDirectoryBody {
  name: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
}

export interface PatchDirectoryBody {
  id: string;
  name?: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
}
