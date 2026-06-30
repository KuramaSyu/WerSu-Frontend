import { BACKEND_BASE } from "../statics";
import type { NoteVersionSummaryReply } from "./models/activity";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * Query parameters for directory activity requests.
 * Mirrors the REST API query params for activity endpoints.
 */
export interface DirectoryActivityQuery {
  directory_id?: string;
  max_depth?: number;
  limit?: number;
  offset?: number;
}

/**
 * API surface for recent-activity queries.
 * Activity is represented as note version summaries.
 */
export interface IActivityApi {
  /**
   * Gets activity for the root (or directory_id when provided).
   */
  getDirectoryActivity(
    query?: DirectoryActivityQuery,
  ): Promise<NoteVersionSummaryReply[]>;
  /**
   * Gets activity for a specific directory id.
   */
  getDirectoryActivityById(
    id: string,
    query?: DirectoryActivityQuery,
  ): Promise<NoteVersionSummaryReply[]>;
  /**
   * Gets activity for a specific note by listing its version summaries.
   */
  getNoteActivity(
    noteId: string,
    limit?: number,
    offset?: number,
  ): Promise<NoteVersionSummaryReply[]>;
}

/**
 * REST client for note and directory activity endpoints.
 */
export class ActivityApi implements IActivityApi {
  /** Logs REST errors consistently to ease debugging. */
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  /**
   * Fetches activity for root or the query's directory_id.
   */
  async getDirectoryActivity(
    query?: DirectoryActivityQuery,
  ): Promise<NoteVersionSummaryReply[]> {
    const url = new URL(`${BACKEND_BASE}/api/directories/activity`);

    // Map optional filters to query-string params.
    if (query?.directory_id !== undefined) {
      url.searchParams.append("directory_id", query.directory_id);
    }
    if (query?.max_depth !== undefined) {
      url.searchParams.append("max_depth", query.max_depth.toString());
    }
    if (query?.limit !== undefined) {
      url.searchParams.append("limit", query.limit.toString());
    }
    if (query?.offset !== undefined) {
      url.searchParams.append("offset", query.offset.toString());
    }

    return this.fetchActivity(url, "/api/directories/activity");
  }

  /**
   * Fetches activity scoped to a specific directory id.
   */
  async getDirectoryActivityById(
    id: string,
    query?: DirectoryActivityQuery,
  ): Promise<NoteVersionSummaryReply[]> {
    const url = new URL(`${BACKEND_BASE}/api/directories/${id}/activity`);

    // Allow optional query parameters for depth and pagination.
    if (query?.directory_id !== undefined) {
      url.searchParams.append("directory_id", query.directory_id);
    }
    if (query?.max_depth !== undefined) {
      url.searchParams.append("max_depth", query.max_depth.toString());
    }
    if (query?.limit !== undefined) {
      url.searchParams.append("limit", query.limit.toString());
    }
    if (query?.offset !== undefined) {
      url.searchParams.append("offset", query.offset.toString());
    }

    return this.fetchActivity(url, `/api/directories/${id}/activity`);
  }

  /**
   * Fetches activity for a note by listing version summaries.
   */
  async getNoteActivity(
    noteId: string,
    limit = 10,
    offset = 0,
  ): Promise<NoteVersionSummaryReply[]> {
    const url = new URL(`${BACKEND_BASE}/api/notes/${noteId}/versions`);
    // Basic pagination to keep payload sizes small.
    url.searchParams.append("limit", limit.toString());
    url.searchParams.append("offset", offset.toString());

    return this.fetchActivity(url, `/api/notes/${noteId}/versions`);
  }

  /**
   * Shared GET handler for activity-style endpoints.
   */
  private async fetchActivity(
    url: URL,
    urlPart: string,
  ): Promise<NoteVersionSummaryReply[]> {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
    });

    // Return empty list on errors so UI can show an empty state.
    if (!response.ok) {
      this.logError(urlPart, `Response not ok: ${response.status}`);
      return [];
    }

    const payload = await response.json().catch((e) => {
      this.logError(urlPart, e);
      return null;
    });

    return (payload ?? []) as NoteVersionSummaryReply[];
  }
}

// Register the default singleton + a typed token so consumers can resolve
// it via `getActivityApi()`.
//
// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const activityApiSingleton = new ActivityApi();
apiRegistry.register(activityApiSingleton);
export const ACTIVITY_API_TOKEN: ApiToken<ActivityApi> = Symbol(
  "ActivityApi",
) as ApiToken<ActivityApi>;
apiRegistry.register(activityApiSingleton, ACTIVITY_API_TOKEN);

/**
 * Resolve the registered `ActivityApi` singleton.
 *
 * Throws if the API isn't registered — see `getNoteApi` for rationale.
 */
export function getActivityApi(): ActivityApi {
  return apiRegistry.get<ActivityApi>(ACTIVITY_API_TOKEN);
}
