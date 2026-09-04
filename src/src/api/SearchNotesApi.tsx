import { BACKEND_BASE } from "../statics";
import type {
  MinimalNote,
  NotesReply,
  RestNotesSearchType,
  SearchFilterOptions,
} from "./models/search";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export interface ISearchNotesApi {
  /**
    Search notes. `options` carries everything that isn't `search_type`
    + `query` (paging, include/exclude ids, date bounds).
    */
  search(
    search_type: RestNotesSearchType,
    query: string,
    options?: SearchFilterOptions,
  ): Promise<NotesReply>;
}

/** Build the query string from positional args plus the optional filter bag. */
function buildSearchParams(
  search_type: RestNotesSearchType,
  query: string,
  options: SearchFilterOptions | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  params.append("search_type", search_type);
  if (query !== "") {
    params.append("query", query);
  }
  if (options?.limit !== undefined) {
    params.append("limit", String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.append("offset", String(options.offset));
  }
  if (options === undefined) {
    return params;
  }
  // Repeat the key per item so IDs may contain commas.
  const appendCsv = (key: string, values: string[] | undefined): void => {
    if (!values || values.length === 0) return;
    for (const value of values) {
      params.append(key, value);
    }
  };
  appendCsv("include_directory_ids", options.include_directory_ids);
  appendCsv("exclude_directory_ids", options.exclude_directory_ids);
  appendCsv("include_shelf_ids", options.include_shelf_ids);
  appendCsv("exclude_shelf_ids", options.exclude_shelf_ids);
  appendCsv("include_tag_ids", options.include_tag_ids);
  appendCsv("exclude_tag_ids", options.exclude_tag_ids);
  if (options.date_from) {
    params.append("date_from", options.date_from);
  }
  if (options.date_until) {
    params.append("date_until", options.date_until);
  }
  return params;
}

export class TestSearchNotesApi implements ISearchNotesApi {
  async search(
    _search_type: RestNotesSearchType,
    _query: string,
    options?: SearchFilterOptions,
  ): Promise<NotesReply> {
    const limit = options?.limit ?? 10;
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

// Represents the backend methods needed for user-facing search.
export class SearchNotesApi implements ISearchNotesApi {
  logError(url_part: string, error: any): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${url_part}:`,
      JSON.stringify(error),
    );
  }

  /** Search notes via the backend search endpoint. */
  async search(
    search_type: RestNotesSearchType,
    query: string,
    options?: SearchFilterOptions,
  ): Promise<NotesReply> {
    const url = new URL(`${BACKEND_BASE}/api/notes/search`);
    url.search = buildSearchParams(search_type, query, options).toString();

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

// IMPORTANT: broadcast-set and typed-token must be the SAME instance.
const searchNotesApiSingleton = new SearchNotesApi();
apiRegistry.register(searchNotesApiSingleton);
export const SEARCH_NOTES_API_TOKEN: ApiToken<SearchNotesApi> = Symbol(
  "SearchNotesApi",
) as ApiToken<SearchNotesApi>;
apiRegistry.register(searchNotesApiSingleton, SEARCH_NOTES_API_TOKEN);

/** Resolve the registered SearchNotesApi singleton. Throws if missing. */
export function getSearchNotesApi(): SearchNotesApi {
  return apiRegistry.get<SearchNotesApi>(SEARCH_NOTES_API_TOKEN);
}
