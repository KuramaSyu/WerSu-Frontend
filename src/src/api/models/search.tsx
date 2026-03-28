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
  permissions: PermissionRelationshipReply[];
}

export interface NoteData extends MinimalNote {
  content: string;
}

export class Note implements NoteData {
  id: string;
  title: string;
  stripped_content: string;
  content: string;
  author_id: string;
  updated_at: string;
  permissions: PermissionRelationshipReply[];

  constructor(data: NoteData) {
    this.id = data.id;
    this.title = data.title;
    this.stripped_content = data.stripped_content ?? data.content;
    this.content = data.content;
    this.author_id = data.author_id;
    this.updated_at = data.updated_at;
    this.permissions = data.permissions;
  }

  static fromJson(data: NoteData): Note {
    return new Note(data);
  }

  get_dir(): string | undefined {
    const parentRelations = this.permissions.filter(
      (permission) =>
        permission.relation === "parent" ||
        permission.relation === "parent_directory",
    );

    for (const permission of parentRelations) {
      if (permission.resource.object_type === "directory") {
        return permission.resource.object_id;
      }
      if (permission.subject.object_type === "directory") {
        return permission.subject.object_id;
      }
    }

    return undefined;
  }
}

export type PermissionObjectType = "note" | "directory" | "user";

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
