import { BACKEND_BASE } from "../statics";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import type { CalculatedStatsReply } from "./models/stats";
import { requestJson } from "./utils/request_helpers";

/**
 * REST surface for the precomputed stats endpoints.
 *
 * The stats are read-only from the frontend's perspective. The backend
 * refreshes each user's row on a daily background process, so values may lag
 * behind recent edits.
 */
export interface IStatsApi {
  /** Read the authenticated caller's precomputed stats. `GET /api/stats` */
  getStats(): Promise<CalculatedStatsReply>;

  /**
   * Read another user's precomputed stats.
   * `GET /api/stats/{user_id}`
   *
   * Requires page-administrator access on the gRPC backend.
   */
  getStatsForUser(userId: string): Promise<CalculatedStatsReply>;
}

/** Default REST implementation backed by the WerSu REST API. */
export class StatsApi implements IStatsApi {
  async getStats(): Promise<CalculatedStatsReply> {
    return await requestJson<CalculatedStatsReply>(
      `${BACKEND_BASE}/api/stats`,
      { method: "GET" },
    );
  }

  async getStatsForUser(userId: string): Promise<CalculatedStatsReply> {
    return await requestJson<CalculatedStatsReply>(
      `${BACKEND_BASE}/api/stats/${encodeURIComponent(userId)}`,
      { method: "GET" },
    );
  }
}

// Register the default singleton plus a typed token so consumers can resolve
// it via `getStatsApi()`.
const statsApiSingleton = new StatsApi();
apiRegistry.register(statsApiSingleton);
export const STATS_API_TOKEN: ApiToken<StatsApi> = Symbol(
  "StatsApi",
) as ApiToken<StatsApi>;
apiRegistry.register(statsApiSingleton, STATS_API_TOKEN);

/** Resolve the registered `StatsApi` singleton. */
export function getStatsApi(): StatsApi {
  return apiRegistry.get<StatsApi>(STATS_API_TOKEN);
}
