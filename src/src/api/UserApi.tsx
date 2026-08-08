import { BACKEND_BASE } from "../statics";
import type { WersuUser } from "../components/DiscordLogin";

import { WersuUserImpl } from "../components/DiscordLogin";
import { useUsersStore, useUserStore } from "../zustand/userStore";
import type { GetAcccessTokenResponse } from "./models/auth";
import { th } from "zod/v4/locales";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import { UserError } from "./models/UserError";

export interface BackendApiInterface {}
export interface UserApiInterface {
  fetchUser(): Promise<WersuUser>;
  fetchUsers(users: string[]): Promise<WersuUser[]>;
  fetchAccessToken(): Promise<GetAcccessTokenResponse>;
}

// Class, to fetch resources from the backend. Responses will be
// set with the Zustand setters
export class DefaultBackendApi implements BackendApiInterface {}

// represents the backend methods, which are needed for user purposes
export class UserApi implements UserApiInterface {
  logError(url_part: string, error: any): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${url_part}:`,
      JSON.stringify(error),
    );
  }

  /**
   * fetches all given users if the current user has access to them.
   * @param users array of userIds to fetch
   * */
  async fetchUsers(users: string[]): Promise<WersuUser[]> {
    // currently not implemented
    const user = await this.fetchUser();
    return [user];

    const response = await fetch(`${BACKEND_BASE}/api/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ users }),
    });
    var userData: WersuUser[] | null = null;
    if (response.ok) {
      userData = await response.json();
    }
    if (userData !== null) {
      return userData as WersuUser[];
    } else {
      this.logError(`/api/auth/users`, response.json());
      throw new Error("Failed to fetch user data");
    }
  }

  /**
   * tries to authenticate a user by coockie.
   * It sets `useUserStore` to the authenticated user
   *
   * Throws a `UserError` with the HTTP status when the request fails
   * so callers (notably `useUser`'s retry policy) can tell a 404
   * "definitely not logged in" apart from a transient network error.
   * */
  async fetchUser(): Promise<WersuUser> {
    const urlPart = "/api/auth/user";
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      credentials: "include",
    });
    if (response.ok) {
      const userData = (await response.json()) as WersuUser;
      return userData;
    }
    const description = await response.text().catch(() => "");
    this.logError(urlPart, {
      status: response.status,
      body: description,
    });
    throw new UserError(
      "Failed to fetch user",
      description || response.statusText || "Unknown error",
      response.status,
    );
  }

  /**
   * fetches an access token from the backend
   * It sets `useUserStore` to the fetched token
   */
  async fetchAccessToken(): Promise<GetAcccessTokenResponse> {
    const url = `${BACKEND_BASE}/api/auth/access-token`;
    const response = await fetch(url, {
      credentials: "include",
    });
    if (response.ok) {
      const tokenData: { token: string } = await response.json().catch((e) => {
        this.logError(url, e);
        throw e;
      });
      if (tokenData.token) {
        return tokenData;
      }
      // 2xx but no JWT — distinct from generic failure so the badge
      // can show a useful diagnostic.
      this.logError(url, {
        status: response.status,
        body: tokenData,
        reason: "empty token in response body",
      });
      throw new Error(
        `Backend returned 2xx but no JWT (status=${response.status})`,
      );
    }
    // Read body once (it can only be consumed once).
    let body: unknown = null;
    try {
      body = await response.clone().text();
    } catch {
      /* ignore */
    }
    this.logError(url, { status: response.status, body });
    throw new Error(`Failed to fetch access token (HTTP ${response.status})`);
  }
}

// Register the default singleton + a typed token so consumers can resolve
// it via `getUserApi()`.
//
// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const userApiSingleton = new UserApi();
apiRegistry.register(userApiSingleton);
export const USER_API_TOKEN: ApiToken<UserApi> = Symbol(
  "UserApi",
) as ApiToken<UserApi>;
apiRegistry.register(userApiSingleton, USER_API_TOKEN);

/**
 * Resolve the registered `UserApi` singleton.
 *
 * Throws if the API isn't registered — see `getNoteApi` for rationale.
 */
export function getUserApi(): UserApi {
  return apiRegistry.get<UserApi>(USER_API_TOKEN);
}
