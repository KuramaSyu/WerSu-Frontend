// REST client for /api/preferences (read, replace, merge, drop).

import { BACKEND_BASE } from "../statics";
import type {
  DeletePreferencesEndpointReply,
  DeletePreferencesEndpointRequest,
  GetPreferencesEndpointReply,
  GetPreferencesEndpointRequest,
  MergePreferencesEndpointReply,
  MergePreferencesEndpointRequest,
  ReplacePreferencesEndpointReply,
  ReplacePreferencesEndpointRequest,
} from "./models/preferences";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export interface PreferencesApi {
  /** Read the stored blob for a (scope, target_id) pair. */
  getPreferences(
    request: GetPreferencesEndpointRequest,
  ): Promise<GetPreferencesEndpointReply>;

  /** Replace the stored blob wholesale with the payload data. */
  replacePreferences(
    request: ReplacePreferencesEndpointRequest,
  ): Promise<ReplacePreferencesEndpointReply>;

  /** Shallow-merge the payload data into the stored blob. */
  mergePreferences(
    request: MergePreferencesEndpointRequest,
  ): Promise<MergePreferencesEndpointReply>;

  /** Drop the stored blob. Idempotent. */
  deletePreferences(
    request: DeletePreferencesEndpointRequest,
  ): Promise<DeletePreferencesEndpointReply>;
}

export abstract class AbstractPreferencesApi implements PreferencesApi {
  abstract getPreferences(
    request: GetPreferencesEndpointRequest,
  ): Promise<GetPreferencesEndpointReply>;
  abstract replacePreferences(
    request: ReplacePreferencesEndpointRequest,
  ): Promise<ReplacePreferencesEndpointReply>;
  abstract mergePreferences(
    request: MergePreferencesEndpointRequest,
  ): Promise<MergePreferencesEndpointReply>;
  abstract deletePreferences(
    request: DeletePreferencesEndpointRequest,
  ): Promise<DeletePreferencesEndpointReply>;
}

export class RestPreferencesApi extends AbstractPreferencesApi {
  async getPreferences(
    request: GetPreferencesEndpointRequest,
  ): Promise<GetPreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences${toQueryString(request)}`;
    return await requestJson<GetPreferencesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async replacePreferences(
    request: ReplacePreferencesEndpointRequest,
  ): Promise<ReplacePreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences`;
    return await requestJson<ReplacePreferencesEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async mergePreferences(
    request: MergePreferencesEndpointRequest,
  ): Promise<MergePreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences`;
    return await requestJson<MergePreferencesEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async deletePreferences(
    request: DeletePreferencesEndpointRequest,
  ): Promise<DeletePreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences`;
    return await requestJson<DeletePreferencesEndpointReply>(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }
}

export const preferencesApi: PreferencesApi = new RestPreferencesApi();

// Register the concrete REST singleton under a typed token so consumers
// can resolve it via getPreferencesApi().
apiRegistry.register(preferencesApi as RestPreferencesApi);
export const PREFERENCES_API_TOKEN: ApiToken<RestPreferencesApi> = Symbol(
  "RestPreferencesApi",
) as ApiToken<RestPreferencesApi>;
apiRegistry.register(
  preferencesApi as RestPreferencesApi,
  PREFERENCES_API_TOKEN,
);

/** Resolve the registered RestPreferencesApi singleton. */
export function getPreferencesApi(): RestPreferencesApi {
  return apiRegistry.get<RestPreferencesApi>(PREFERENCES_API_TOKEN);
}
