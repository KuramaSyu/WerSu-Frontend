/*
 * Property-injection contract for the share access token.
 *
 * Background
 * ----------
 * Logged-in users authenticate with cookies + a user JWT.
 * Anonymous public-share viewers authenticate with a separate "share JWT".
 * Both are sent as `Authorization: Bearer <token>`.
 *
 * The user JWT lives in `useAuthStore.accessToken` and is already wired up.
 * The share JWT lives in `useAuthStore.shareAccessToken` and must be wired up
 * to the same APIs — but ONLY when a public share is active. To keep the
 * authentication branch opt-in (and the default code path unchanged for
 * logged-in users), every API that should accept the share JWT implements
 * `ShareTokenBearer` by extending `ShareTokenBearerMixin`.
 *
 * Usage in an API
 * ---------------
 *   class NoteApi extends ShareTokenBearerMixin implements INoteApi {
 *     async get(id: string) {
 *       const headers = { "Content-Type": "application/json", ...(await this.resolveShareAuthHeader()) };
 *       return requestJson(`/notes/${id}`, { headers });
 *     }
 *   }
 *
 * Toggling it on / off
 * --------------------
 *   // turn on (anonymous public share mode):
 *   apiRegistry.installShareTokenProvider(
 *     () => useAuthStore.getState().shareAccessToken,
 *   );
 *
 *   // turn off (back to logged-in user, or no auth at all):
 *   apiRegistry.installShareTokenProvider(null);
 */

/**
 * A function that returns the current share access token, or null/undefined
 * when none is available. May be sync or async so it can refresh on demand.
 */
export type ShareTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

/**
 * Property-injection interface.
 *
 * Implement this on any object that needs to attach the share access token
 * to outgoing requests. The provider is set at runtime, not at construction
 * time — that's the whole point of property injection: the API doesn't
 * depend on `useAuthStore` directly, and the provider can be null'd out to
 * fully disable the feature.
 */
export interface ShareTokenBearer {
  /**
   * Inject a provider that returns the current share access token, or
   * `null` to disable share-token attachment for this API entirely.
   */
  setShareTokenProvider(provider: ShareTokenProvider | null): void;

  /** Read back the currently installed provider, mostly for testing/diagnostics. */
  getShareTokenProvider(): ShareTokenProvider | null;
}

/**
 * Base class that implements `ShareTokenBearer`. APIs extend this and call
 * `this.resolveShareAuthHeader()` from inside `requestJson` calls to
 * receive a `Record<string,string>` they can spread into their headers.
 *
 * It is intentionally a mixin (not an interface-only contract) so the
 * provider storage lives in one place instead of being copy-pasted into
 * every API.
 */
export abstract class ShareTokenBearerMixin implements ShareTokenBearer {
  private _shareTokenProvider: ShareTokenProvider | null = null;

  setShareTokenProvider(provider: ShareTokenProvider | null): void {
    this._shareTokenProvider = provider;
  }

  getShareTokenProvider(): ShareTokenProvider | null {
    return this._shareTokenProvider;
  }

  /**
   * Resolves the currently installed provider into an
   * `Authorization: Bearer <token>` header record, or `{}` when no
   * provider is installed or the provider yields a falsy token.
   *
   * Always `await` this — providers may be async.
   */
  protected async resolveShareAuthHeader(): Promise<Record<string, string>> {
    if (!this._shareTokenProvider) {
      return {};
    }
    const token = await this._shareTokenProvider();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
