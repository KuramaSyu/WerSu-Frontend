import { BACKEND_BASE } from "../statics";
import type {
  ActivityReply,
  ActivityScoreReply,
  HistoryFilter,
} from "./models/history";
import { ShareTokenBearerMixin } from "./shareToken";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import { toQueryString } from "./utils/request_helpers";

/** Path mounted by the Go `ActivityController.GetActivityHistory`. */
const HISTORY_API_PATH = "/api/history";

/**
 * REST surface for `GET /api/history`.
 *
 * The endpoint serves two response shapes, selected via `mode`:
 *   - `mode=history` (default) returns `ActivityReply[]`
 *   - `mode=most_used` returns `ActivityScoreReply[]`
 *
 * Both methods here pin `mode` for the caller so consumers can't
 * accidentally ask for the wrong shape.
 */
export interface IHistoryApi {
  /**
   * Stream activity history (when `filter.mode` is `history`).
   *
   * If `filter.mode` is not `"history"`, the request is still
   * issued with `mode=history` forced in the query string so the
   * backend's response matches the typed return.
   */
  getActivityHistory(filter: HistoryFilter): Promise<ActivityReply[]>;

  /**
   * Stream aggregated most-used scores (when `filter.mode` is
   * `most_used`). `filter.algorithm` controls the scoring
   * function; defaults to `MOST_USED_ALGORITHM_COUNT` server-side
   * when omitted.
   */
  getMostUsed(filter: HistoryFilter): Promise<ActivityScoreReply[]>;
}

// Extends `ShareTokenBearerMixin` so the API can attach an
// `Authorization: Bearer <share-jwt>` header when a public share
// is active. The endpoint currently requires a logged-in user
// (`UserFromContext` on the Go side), so in practice the bearer
// header is never sent -- the mixin is here for parity with
// `NoteApi` / `DirectoryApi` and to avoid touching this file
// again if a public-share variant is added later.
export class HistoryApi extends ShareTokenBearerMixin implements IHistoryApi {
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  /**
   * Builds the request URL for a given filter, pinning `mode`.
   */
  private buildUrl(
    filter: HistoryFilter,
    mode: "history" | "most_used",
  ): string {
    // Preserve the caller's filter shape, then pin `mode` last so
    // an accidental `mode` in `filter` can't override the typed
    // variant this method serves.
    const params = { ...filter, mode };
    return `${BACKEND_BASE}${HISTORY_API_PATH}${toQueryString(params)}`;
  }

  /**
   * Shared GET handler. Errors degrade to `[]` so the UI can show
   * an empty state -- matches the existing `ActivityApi` policy.
   */
  private async fetchJson<T>(url: string): Promise<T> {
    const init = await this.getFetchParameters("GET");
    const response = await fetch(url, init);
    if (!response.ok) {
      this.logError(
        `${HISTORY_API_PATH} (${response.status})`,
        `Response not ok: ${response.status} ${response.statusText}`,
      );
      return [] as unknown as T;
    }
    const payload = await response.json().catch((e) => {
      this.logError(HISTORY_API_PATH, e);
      return null;
    });
    return (payload ?? []) as T;
  }

  async getActivityHistory(filter: HistoryFilter): Promise<ActivityReply[]> {
    const url = this.buildUrl(filter, "history");
    return this.fetchJson<ActivityReply[]>(url);
  }

  async getMostUsed(filter: HistoryFilter): Promise<ActivityScoreReply[]> {
    const url = this.buildUrl(filter, "most_used");
    return this.fetchJson<ActivityScoreReply[]>(url);
  }
}

// Register the default singleton + a typed token so consumers can
// resolve it via `getHistoryApi()`. IMPORTANT: broadcast-set +
// typed-token must be the SAME instance. See NoteApi for the bug
// history.
const historyApiSingleton = new HistoryApi();
apiRegistry.register(historyApiSingleton);
export const HISTORY_API_TOKEN: ApiToken<HistoryApi> = Symbol("HistoryApi");
apiRegistry.register(historyApiSingleton, HISTORY_API_TOKEN);

/**
 * Resolve the registered `HistoryApi` singleton.
 *
 * Throws if the API isn't registered -- see `getNoteApi` for
 * rationale (silent undefined is the #1 source of "why is my
 * fetch missing the auth header" bugs).
 */
export function getHistoryApi(): HistoryApi {
  return apiRegistry.get<HistoryApi>(HISTORY_API_TOKEN);
}
