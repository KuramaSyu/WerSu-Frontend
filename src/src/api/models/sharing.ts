export interface NoteShareReply {
  id: string;
  description?: string;
  note_id: string;
  created_at?: string;
  created_by: string;
  online_since?: string;
  online_until?: string;
  access_as: string;
}

export interface CreateShareBody {
  description?: string;
  note_id: string;
  online_since?: string;
  online_until?: string;
  access_as: string;
}

export interface UpdateShareBody {
  id: string;
  description?: string;
  note_id: string;
  online_since?: string;
  online_until?: string;
  access_as: string;
}

export interface DeleteSharesBody {
  share_ids: string[];
}

export interface GetSharesQuery {
  note_id?: string;
  created_by?: string;
  online_since?: string;
  online_until?: string;
  access_as?: string;
}

export interface GetSharesByIdRequest {
  share_ids: string[];
}

export interface GetShareByIdRequest {
  id: string;
}

export interface CreateShareEndpointRequest {
  share: CreateShareBody;
}
export type CreateShareEndpointReply = NoteShareReply;

export interface UpdateShareEndpointRequest {
  share: UpdateShareBody;
}
export type UpdateShareEndpointReply = NoteShareReply;

export type GetSharesByIdEndpointRequest = GetSharesByIdRequest;
export type GetSharesByIdEndpointReply = NoteShareReply[];

export type GetSharesEndpointRequest = GetSharesQuery;
export type GetSharesEndpointReply = NoteShareReply[];

export type DeleteSharesEndpointRequest = DeleteSharesBody;
export type DeleteSharesEndpointReply = void;

export type GetShareByIdEndpointRequest = GetShareByIdRequest;
export type GetShareByIdEndpointReply = NoteShareReply;
