// REST client for the linked-credentials surface.
//
// Today this is a single read endpoint (GET /api/auth/me/credentials)
// used by Settings -> Security to render the linked-methods card.
// The popup-based link flow itself does NOT go through this client;
// the SPA only opens a popup to /api/auth/link/{p}/init and listens
// for the postMessage from the /complete HTML page.

import { BACKEND_BASE } from "../statics";
import { requestJson } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import type { LinkedCredentialsReply } from "./models/linkedProviders";

export interface ILinkedProvidersApi {
  /** GET /api/auth/me/credentials */
  getLinkedCredentials(): Promise<LinkedCredentialsReply>;
}

export class LinkedProvidersApi implements ILinkedProvidersApi {
  async getLinkedCredentials(): Promise<LinkedCredentialsReply> {
    return await requestJson<LinkedCredentialsReply>(
      `${BACKEND_BASE}/api/auth/me/credentials`,
      { method: "GET" },
    );
  }
}

const linkedProvidersApiSingleton = new LinkedProvidersApi();
apiRegistry.register(linkedProvidersApiSingleton);
export const LINKED_PROVIDERS_API_TOKEN: ApiToken<LinkedProvidersApi> = Symbol(
  "LinkedProvidersApi",
) as ApiToken<LinkedProvidersApi>;
apiRegistry.register(linkedProvidersApiSingleton, LINKED_PROVIDERS_API_TOKEN);

export function getLinkedProvidersApi(): LinkedProvidersApi {
  return apiRegistry.get<LinkedProvidersApi>(LINKED_PROVIDERS_API_TOKEN);
}
