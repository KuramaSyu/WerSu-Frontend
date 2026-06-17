import { BACKEND_BASE } from "../statics";
import type { DiscordUser } from "../components/DiscordLogin";

import { DiscordUserImpl } from "../components/DiscordLogin";
import { useUsersStore, useUserStore } from "../zustand/userStore";
import type { GetAcccessTokenResponse } from "./models/auth";
import { th } from "zod/v4/locales";

export interface BackendApiInterface {}
export interface UserApiInterface {
  fetchUser(): Promise<DiscordUser>;
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
   * tries to authenticate a user by coockie.
   * It sets `useUserStore` to the authenticated user
   * */
  async fetchUser(): Promise<DiscordUser> {
    const response = await fetch(`${BACKEND_BASE}/api/auth/user`, {
      credentials: "include",
    });
    var userData: DiscordUser | null = null;
    if (response.ok) {
      userData = await response.json();
    }
    if (userData) {
      return userData;
    } else {
      this.logError(`/api/auth/user`, response.json());
      throw new Error("Failed to fetch user data");
    }
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
    }
    this.logError(url, response.json());
    throw new Error("Failed to fetch access token");
  }
}
