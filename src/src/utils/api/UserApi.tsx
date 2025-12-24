import { BACKEND_BASE } from '../../statics';
import type { DiscordUser } from '../../components/DiscordLogin';

import { DiscordUserImpl } from '../../components/DiscordLogin';
import { useUserStore } from '../../zustand/userStore';

export interface BackendApiInterface {}
export interface UserApiInterface {
  fetchUser(): Promise<Response>;
}

// Class, to fetch resources from the backend. Responses will be
// set with the Zustand setters
export class DefaultBackendApi implements BackendApiInterface {}

// represents the backend methods, which are needed for user purposes
export class UserApi implements UserApiInterface {
  logError(url_part: string, error: any): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${url_part}:`,
      JSON.stringify(error)
    );
  }

  /**
   * tries to authenticate a user by coockie.
   * It sets `useUserStore` to the authenticated user
   * */
  async fetchUser(): Promise<Response> {
    const setUser = useUserStore.getState().setUser;
    const response = await fetch(`${BACKEND_BASE}/api/auth/user`, {
      credentials: 'include',
    });
    if (response.ok) {
      const userData: DiscordUser | null = await response.json().catch((e) => {
        this.logError(`/api/auth/user`, e);
        return null;
      });
      if (userData) setUser(new DiscordUserImpl(userData));
    } else {
      this.logError(`/api/auth/user`, response.json());
    }
    return response;
  }
}
