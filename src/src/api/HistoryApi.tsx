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

/** REST surface for `GET /api/history`; both methods pin `mode` so callers can't ask for the wrong shape. */
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

// Extends `ShareTokenBearerMixin` for parity with `NoteApi`/`DirectoryApi`; bearer is unused in practice (`UserFromContext` required server-side).
export class HistoryApi extends ShareTokenBearerMixin implements IHistoryApi {
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  /** Builds the request URL for a given filter, pinning `mode`. */
  private buildUrl(
    filter: HistoryFilter,
    mode: "history" | "most_used",
  ): string {
    // Pin `mode` last so an accidental `mode` in `filter` can't override the typed variant.
    const params = { ...filter, mode };
    return `${BACKEND_BASE}${HISTORY_API_PATH}${toQueryString(params)}`;
  }

  /** Shared GET handler; errors degrade to `[]` to match `ActivityApi` policy. */
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

// Broadcast-set and typed-token must be the SAME instance; see `NoteApi` for the bug history.
const historyApiSingleton = new HistoryApi();
apiRegistry.register(historyApiSingleton);
export const HISTORY_API_TOKEN: ApiToken<HistoryApi> = Symbol("HistoryApi");
apiRegistry.register(historyApiSingleton, HISTORY_API_TOKEN);

/** Resolve the registered `HistoryApi` singleton; throws if not registered (matches `getNoteApi`). */
export function getHistoryApi(): HistoryApi {
  return apiRegistry.get<HistoryApi>(HISTORY_API_TOKEN);
}
