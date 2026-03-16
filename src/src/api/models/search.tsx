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
}

export interface Note {
  id: string;
  title: string;
  content: string;
  author_id: string;
  updated_at: string; // Or Date, depending on how it's deserialized
}
