/*
 * Central registry for API instances.
 *
 * Two roles, one container:
 *   1. Broadcast — `installShareTokenProvider(p)` pushes the share-token
 *      provider onto every API that opted in (extends `ShareTokenBearerMixin`).
 *   2. Service locator — `get(token)` retrieves a specific registered API by
 *      a typed token. This lets call sites ask for "the NoteApi" without
 *      caring whether it's a singleton or a fresh instance.
 *
 * The registry holds plain object references (no DI library, no decorators).
 * To make an API participate in share-token injection, extend
 * `ShareTokenBearerMixin` (see `./shareToken.ts`) and call
 * `apiRegistry.register(api, token)` once at module load time.
 *
 * Typed retrieval example
 * -----------------------
 *   // in NoteApi.tsx
 *   export const NOTE_API_TOKEN = Symbol("NoteApi");
 *   apiRegistry.register(new NoteApi(), NOTE_API_TOKEN);
 *
 *   // anywhere else:
 *   import { apiRegistry, NOTE_API_TOKEN } from "./NoteApi";
 *   const noteApi = apiRegistry.get<NoteApi>(NOTE_API_TOKEN);
 *   const note = await noteApi.get("123");
 *
 * Strictness
 * ----------
 * We duck-type check for `setShareTokenProvider` so unrelated APIs can be
 * safely registered without throwing. `get(token)` throws if no instance is
 * registered under that token — call-site bugs surface immediately instead
 * of silently degrading.
 */

import type { ShareTokenBearer, ShareTokenProvider } from "./shareToken";

/**
 * Structural shape any bearer-aware API must satisfy.
 */
type BearerAware = Pick<ShareTokenBearer, "setShareTokenProvider">;

function isBearerAware(value: object): value is BearerAware {
  const candidate = value as { setShareTokenProvider?: unknown };
  return typeof candidate.setShareTokenProvider === "function";
}

/**
 * Opaque, structurally-unique identifier used to look up a specific API
 * from the registry.
 *
 * Use `Symbol(description)` so the token can't be fabricated by other
 * modules and so it shows up nicely in stack traces.
 */
export type ApiToken<T> = symbol & { readonly __apiBrand?: T };

export class ApiRegistry {
  // The Map is keyed by an opaque token. The bare Set of objects is kept
  // for the "broadcast to everything" use case (no token).
  private readonly byToken = new Map<symbol, object>();
  private readonly apis = new Set<object>();

  /**
   * Register an API instance. Without a token it joins the broadcast set;
   * with a token it also becomes retrievable via `get(token)`.
   *
   * Calling `register(sameInstance, differentToken)` would associate the
   * same instance under two tokens. We don't forbid it because some callers
   * may legitimately want to expose one object under multiple roles.
   */
  register<T>(api: object, token?: ApiToken<T>): void {
    this.apis.add(api);
    if (token !== undefined) {
      this.byToken.set(token, api);
    }
  }

  /**
   * Unregister a previously registered API. If a token is supplied, only
   * that token mapping is removed; the API still remains in the broadcast
   * set. If no token is supplied, the API is removed from both.
   */
  unregister(api: object, token?: symbol): void {
    if (token !== undefined) {
      this.byToken.delete(token);
      return;
    }
    this.apis.delete(api);
    // Also drop any token mappings that pointed at this instance.
    for (const [t, candidate] of this.byToken) {
      if (candidate === api) this.byToken.delete(t);
    }
  }

  /**
   * Retrieve a registered API by its token.
   *
   * @throws if no instance is registered under that token. This is
   * deliberate — silent `undefined` return values are the #1 source of
   * "why is my fetch using the wrong auth" bugs.
   */
  get<T extends object>(token: ApiToken<T>): T {
    const api = this.byToken.get(token);
    if (!api) {
      throw new Error(
        `apiRegistry.get: no instance registered for token ${String(token)}`,
      );
    }
    return api as T;
  }

  /**
   * Try to retrieve an API by token; return `undefined` instead of throwing.
   * Useful in optional wiring paths (e.g. from a plugin that may not be
   * installed in every environment).
   */
  tryGet<T extends object>(token: ApiToken<T>): T | undefined {
    return this.byToken.get(token) as T | undefined;
  }

  /**
   * Install a share-token provider on every registered API that implements
   * `ShareTokenBearer`. Pass `null` to disable share-token injection globally.
   *
   * APIs that don't implement the contract are silently skipped.
   */
  installShareTokenProvider(provider: ShareTokenProvider | null): void {
    for (const api of this.apis) {
      if (isBearerAware(api)) {
        api.setShareTokenProvider(provider);
      }
    }
  }

  /**
   * Snapshot of every registered API instance. Useful for diagnostics
   * and for tests that want to assert on what's installed.
   */
  list(): readonly object[] {
    return [...this.apis];
  }

  /** Test helper: clears the registry. */
  clear(): void {
    this.apis.clear();
    this.byToken.clear();
  }
}

/** Singleton registry — the one true entry point. */
export const apiRegistry = new ApiRegistry();
