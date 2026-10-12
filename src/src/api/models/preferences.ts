// Wire types for /api/preferences.

export type PreferenceScope = "user" | "shelf" | "role";

export interface GetPreferencesQuery {
  scope: PreferenceScope;
  target_id: string;
}

export interface PreferencesJsonBody {
  scope: PreferenceScope;
  target_id: string;
  data: Record<string, unknown>;
}

export interface DeletePreferencesBody {
  scope: PreferenceScope;
  target_id: string;
}

export interface PreferencesReply {
  scope: PreferenceScope;
  target_id: string;
  data: Record<string, unknown>;
}

export interface DeletePreferencesReply {
  success: boolean;
}

export type GetPreferencesEndpointRequest = GetPreferencesQuery;
export type GetPreferencesEndpointReply = PreferencesReply;

export type ReplacePreferencesEndpointRequest = PreferencesJsonBody;
export type ReplacePreferencesEndpointReply = PreferencesReply;

export type MergePreferencesEndpointRequest = PreferencesJsonBody;
export type MergePreferencesEndpointReply = PreferencesReply;

export type DeletePreferencesEndpointRequest = DeletePreferencesBody;
export type DeletePreferencesEndpointReply = DeletePreferencesReply;
