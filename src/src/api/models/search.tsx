export enum RestNotesSearchType {
  CONTEXT = "context",
  KEYWORD = "keyword",
  TYPO_TOLERANT = "typo_tolerant",
  LATEST = "latest",
}

export interface GetSearchNotesRequest {
  search_type: RestNotesSearchType;
  query: string;
  limit: number;
  offset: number;
}

export interface MinimalNote {
  id: string;
  title: string;
  author_id: string;
  updated_at: string; // Or Date, depending on how it's deserialized
  stripped_content: string;
  /**
   * Parent directories of this note. Empty when the note lives at the root.
   */
  directory_ids: string[];
  /**
   * Tags assigned to this note.
   */
  tag_ids: string[];
}

export interface NoteData extends MinimalNote {
  content: string;
  /**
   * Optional permission relationships. Kept on the model for legacy
   * callers (attachment lookups via `get_attachment_ids`). Parents
   * are no longer derived from here — use `directory_ids`.
   */
  permissions?: PermissionRelationshipReply[];
  // Optional attachment ID to JWT mapping, that public users can access images
  tokens?: Record<string, string>;
}

export class Note implements NoteData {
  id: string;
  title: string;
  stripped_content: string;
  content: string;
  author_id: string;
  updated_at: string;
  directory_ids: string[];
  tag_ids: string[];
  /**
   * Attachments still come over the legacy permission API as
   * `parent_note` relations; this is the only consumer of
   * `permissions` we keep.
   */
  permissions: PermissionRelationshipReply[];
  tokens?: Record<string, string> | undefined;

  constructor(data: NoteData) {
    this.id = data.id;
    this.title = data.title;
    this.stripped_content = data.stripped_content ?? data.content;
    this.content = data.content;
    this.author_id = data.author_id;
    this.updated_at = data.updated_at;
    this.directory_ids = data.directory_ids ?? [];
    this.tag_ids = data.tag_ids ?? [];
    this.permissions = data.permissions ?? [];
    this.tokens = data.tokens;
  }

  static fromJson(data: NoteData): Note {
    return new Note(data);
  }

  /**
   * Returns the first parent directory id, mirroring the legacy
   * `get_dir()` contract used by single-parent flows (drag-and-drop,
   * search overlay, breadcrumb).
   */
  get_dir(): string | undefined {
    return this.directory_ids[0];
  }

  /**
   * Returns the attachment ids attached to this note via the legacy
   * `parent_note` permission relationship. Kept for callers that
   * still rely on the permission-based attachment lookup.
   */
  get_attachment_ids(): string[] {
    const attachmentRelations = this.permissions.filter(
      (permission) =>
        permission.relation === "parent_note" &&
        permission.resource.object_type === "PERMISSION_OBJECT_TYPE_ATTACHMENT",
    );
    return attachmentRelations.map(
      (permission) => permission.resource.object_id,
    );
  }
}

export interface MinimalDirectory {
  id: string;
  display_name?: string;
  slug?: string;
}

export interface MinimalTag {
  id: string;
  display_name?: string;
  slug?: string;
}

/**
 * Wire shape for `GET /api/notes/search` and the directory-scoped
 * `GET /api/directories/:id/notes`. The backend embeds every
 * directory/tag referenced by the returned notes so the client can
 * resolve labels without further round-trips.
 */
export interface NotesReply {
  notes: MinimalNote[];
  directories: MinimalDirectory[];
  tags: MinimalTag[];
}

export type PermissionObjectType =
  | "note"
  | "directory"
  | "user"
  | "PERMISSION_OBJECT_TYPE_USER"
  | "PERMISSION_OBJECT_TYPE_UNSPECIFIED"
  | "PERMISSION_OBJECT_TYPE_NOTE"
  | "PERMISSION_OBJECT_TYPE_DIRECTORY"
  | "PERMISSION_OBJECT_TYPE_ATTACHMENT";

export interface PermissionResourceReply {
  object_id: string;
  object_type: PermissionObjectType;
}

export interface PermissionSubjectReply {
  object_id: string;
  object_type: PermissionObjectType;
}

export interface PermissionRelationshipReply {
  relation: string;
  resource: PermissionResourceReply;
  subject: PermissionSubjectReply;
}

export interface PermissionResourceRequest {
  object_id: string;
  object_type: "note" | "directory";
}

export interface PermissionSubjectRequest {
  object_id: string;
  object_type: "user" | "directory";
}

export interface PermissionRelationshipRequest {
  relation:
    | "owner"
    | "admin"
    | "writer"
    | "reader"
    | "parent"
    | "parent_directory"
    | "parent_note";
  resource?: PermissionResourceRequest;
  subject?: PermissionSubjectRequest;
}

export interface PermissionsReply {
  object_id: string;
  object_type:
    | "PERMISSION_OBJECT_TYPE_UNSPECIFIED"
    | "PERMISSION_OBJECT_TYPE_NOTE"
    | "PERMISSION_OBJECT_TYPE_DIRECTORY"
    | "PERMISSION_OBJECT_TYPE_ATTACHMENT";
  relationships: PermissionRelationshipReply[];
}

export interface ReplacePermissionsBody {
  object_id: string;
  object_type: "note" | "directory" | "attachment";
  relationships: PermissionRelationshipRequest[];
}

export interface CreatePermissionBody {
  object_id: string;
  object_type: "note" | "directory" | "attachment";
  relationship: PermissionRelationshipRequest;
}

export interface DeletePermissionBody {
  object_id: string;
  object_type: "note" | "directory" | "attachment";
  relationship: PermissionRelationshipRequest;
}
