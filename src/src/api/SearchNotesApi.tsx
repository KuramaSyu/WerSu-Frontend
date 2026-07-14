import { BACKEND_BASE } from "../statics";
import type {
  MinimalNote,
  NotesReply,
  RestNotesSearchType,
} from "./models/search";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export interface ISearchNotesApi {
  search(
    search_type: RestNotesSearchType,
    query: string,
    limit?: number,
    offset?: number,
  ): Promise<NotesReply>;
}

export class TestSearchNotesApi implements ISearchNotesApi {
  async search(
    _search_type: RestNotesSearchType,
    _query: string,
    limit: number = 10,
    _offset: number = 0,
  ): Promise<NotesReply> {
    // Returns 30 dummy notes for testing.
    const notes: MinimalNote[] = [];
    for (let i = 0; i < limit; i++) {
      notes.push({
        id: String(i + 1),
        title: `Test Note ${i + 1}`,
        author_id: "1",
        updated_at: new Date().toISOString(),
        stripped_content: `This is the content of Test Note ${i + 1}`,
        directory_ids: [],
        tag_ids: [],
      });
    }
    return { notes, directories: [], tags: [] };
  }
}

// represents the backend methods, which are needed for user purposes
export class SearchNotesApi implements ISearchNotesApi {
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
  async search(
    search_type: RestNotesSearchType,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<NotesReply> {
    // Build URL with query parameters
    const url = new URL(`${BACKEND_BASE}/api/notes/search`);
    url.searchParams.append("search_type", search_type);
    url.searchParams.append("query", query);
    url.searchParams.append("limit", limit.toString());
    url.searchParams.append("offset", offset.toString());
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const reply = await response.json().catch((e) => {
        this.logError(`/api/notes/search`, String(e));
        return null;
      });
      const safe = reply ?? { notes: [], directories: [], tags: [] };
      console.log("fetched notes reply:", safe);
      return {
        notes: safe.notes ?? [],
        directories: safe.directories ?? [],
        tags: safe.tags ?? [],
      };
    }
    this.logError(
      `/api/notes/search`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return { notes: [], directories: [], tags: [] };
  }
}

// Register the default singleton + a typed token so consumers can resolve
// it via `getSearchNotesApi()`.
//
// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const searchNotesApiSingleton = new SearchNotesApi();
apiRegistry.register(searchNotesApiSingleton);
export const SEARCH_NOTES_API_TOKEN: ApiToken<SearchNotesApi> = Symbol(
  "SearchNotesApi",
) as ApiToken<SearchNotesApi>;
apiRegistry.register(searchNotesApiSingleton, SEARCH_NOTES_API_TOKEN);

/**
 * Resolve the registered `SearchNotesApi` singleton.
 *
 * Throws if the API isn't registered — see `getNoteApi` for rationale.
 */
export function getSearchNotesApi(): SearchNotesApi {
  return apiRegistry.get<SearchNotesApi>(SEARCH_NOTES_API_TOKEN);
}
