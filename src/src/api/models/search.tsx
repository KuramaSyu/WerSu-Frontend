export enum RestNotesSearchType {
  CONTEXT = "context",
  KEYWORD = "keyword",
  TYPO_TOLERANT = "typo_tolerant",
  LATEST = "latest",
}

/** Filter bag for the notes search endpoint. */
export interface SearchFilterOptions {
  limit?: number;
  offset?: number;
  /** Restrict to notes in any of these directories. */
  include_directory_ids?: string[];
  /** Exclude notes in any of these directories. */
  exclude_directory_ids?: string[];
  /** Restrict to notes on any of these shelves. */
  include_shelf_ids?: string[];
  /** Exclude notes on any of these shelves. */
  exclude_shelf_ids?: string[];
  /** Restrict to notes tagged with any of these tags. */
  include_tag_ids?: string[];
  /** Exclude notes tagged with any of these tags. */
  exclude_tag_ids?: string[];
  /** RFC3339 lower bound on note updated_at. */
  date_from?: string;
  /** RFC3339 upper bound on note updated_at. */
  date_until?: string;
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
  /** Parent directories. Empty when the note lives at the root. */
  directory_ids: string[];
  /** Tags assigned to this note. */
  tag_ids: string[];
}

export interface NoteData extends MinimalNote {
  content: string;
  /** Attachment ids linked to this note. Returned by GET /api/notes/:id. */
  attachment_ids?: string[];
  /** Optional permission relationships (legacy callers). */
  permissions?: PermissionRelationshipReply[];
  // Optional attachment ID to JWT mapping for public image access.
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
  /** Attachment ids linked to this note. */
  attachment_ids: string[];
  /** Optional permission relationships. */
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
    this.attachment_ids = data.attachment_ids ?? [];
    this.permissions = data.permissions ?? [];
    this.tokens = data.tokens;
  }

  static fromJson(data: NoteData): Note {
    return new Note(data);
  }

  /** Returns the first parent directory id (legacy single-parent flows). */
  get_dir(): string | undefined {
    return this.directory_ids[0];
  }

  /** Returns attachment ids. Prefer the field directly at call sites. */
  get_attachment_ids(): string[] {
    return this.attachment_ids;
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

/** Wire shape for notes search and directory-scoped notes endpoints. */
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
