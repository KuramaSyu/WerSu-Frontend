import { BACKEND_BASE } from '../statics';
import { useSearchNotesStore } from '../zustand/useSearchNotesStore';
import { useUserStore } from '../zustand/userStore';
import type {
  MinimalNote,
  GetSearchNotesRequest,
  RestNotesSearchType,
} from './models/search';

export interface ISearchNotesApi {
  search(
    search_type: RestNotesSearchType,
    query: string,
    limit?: number,
    offset?: number
  ): Promise<MinimalNote[]>;
}

export class TestSearchNotesApi implements ISearchNotesApi {
  async search(
    search_type: RestNotesSearchType,
    query: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<MinimalNote[]> {
    // Returns 30 dummy notes for testing
    const results: MinimalNote[] = [];
    for (let i = 0; i < 30; i++) {
      results.push({
        id: i + 1,
        title: `Test Note ${i + 1}`,
        author_id: 1,
        updated_at: new Date().toISOString(),
        stripped_content: `This is the content of Test Note ${i + 1}`,
      });
    }
    return results;
  }
}

// represents the backend methods, which are needed for user purposes
export class SearchNotesApi implements ISearchNotesApi {
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
  async search(
    search_type: RestNotesSearchType,
    query: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<MinimalNote[]> {
    const setNotes = useSearchNotesStore.getState().setNotes;

    // Build URL with query parameters
    const url = new URL(`${BACKEND_BASE}/api/notes/search`);
    url.searchParams.append('search_type', search_type);
    url.searchParams.append('query', query);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const notes: MinimalNote[] = await response.json().catch((e) => {
        this.logError(`/api/notes/search`, String(e));
        return [];
      });
      console.log('fetched notes:', notes);
      setNotes(notes);
      return notes;
    }
    this.logError(
      `/api/notes/search`,
      `Response not ok: ${response.status}; ${response.statusText}`
    );
    return [];
  }
}
