import { BACKEND_BASE } from "../statics";
import type {
  CreateDirectoryBody,
  DirectoryReply,
  PatchDirectoryBody,
} from "./models/directory.ts";
import type { NotesReply } from "./models/search";
import { ShareTokenBearerMixin } from "./shareToken";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import { UserError } from "./models/UserError";

const DIRECTORIES_API_PATH = "/api/directories";

export interface ListDirectoriesQuery {
  parent_id?: string;
  limit?: number;
  offset?: number;
  /** Fill parent_dir_ids on each reply. Default true. */
  include_parents?: boolean;
  /** Fill child_dir_ids on each reply. Default true. */
  include_child_dirs?: boolean;
  /** Fill child_note_ids on each reply. Default false. */
  include_child_notes?: boolean;
  /** Fill shelf_ids on each reply. Default true. */
  include_shelves?: boolean;
}

export interface GetDirectoryQuery {
  /** include_* flags for GET /api/directories/:id. */
  include_parents?: boolean;
  include_child_dirs?: boolean;
  include_child_notes?: boolean;
  include_shelves?: boolean;
}

export interface ListDirectoryNotesQuery {
  limit?: number;
  offset?: number;
}

export interface IDirectoryApi {
  list(query?: ListDirectoriesQuery): Promise<DirectoryReply[]>;
  get(
    id: string,
    query?: GetDirectoryQuery,
  ): Promise<DirectoryReply | undefined>;
  listNotes(id: string, query?: ListDirectoryNotesQuery): Promise<NotesReply>;
  create(payload: CreateDirectoryBody): Promise<DirectoryReply | undefined>;
  patch(payload: PatchDirectoryBody): Promise<DirectoryReply | undefined>;
  setParent(
    id: string,
    parentIds: string[] | null,
  ): Promise<DirectoryReply | undefined>;
  delete(id: string): Promise<DirectoryReply | undefined>;
}

// Extends `ShareTokenBearerMixin` so directory endpoints can attach the
// anonymous share JWT when a public share is active. See `NoteApi` for the
// full rationale — `DirectoryApi` follows the same pattern.
export class DirectoryApi
  extends ShareTokenBearerMixin
  implements IDirectoryApi
{
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  private async authHeaders(
    base: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    return { ...base, ...(await this.resolveShareAuthHeader()) };
  }

  async list(query?: ListDirectoriesQuery): Promise<DirectoryReply[]> {
    const url = new URL(`${BACKEND_BASE}${DIRECTORIES_API_PATH}`);

    if (query?.parent_id !== undefined) {
      url.searchParams.append("parent_id", query.parent_id);
    }
    if (query?.limit !== undefined) {
      url.searchParams.append("limit", query.limit.toString());
    }
    if (query?.offset !== undefined) {
      url.searchParams.append("offset", query.offset.toString());
    }
    // Defaults: parents + child dirs + shelves on, child notes off.
    url.searchParams.append(
      "include_parents",
      (query?.include_parents ?? true).toString(),
    );
    url.searchParams.append(
      "include_child_dirs",
      (query?.include_child_dirs ?? true).toString(),
    );
    url.searchParams.append(
      "include_child_notes",
      (query?.include_child_notes ?? false).toString(),
    );
    url.searchParams.append(
      "include_shelves",
      (query?.include_shelves ?? true).toString(),
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      this.logError(
        `${DIRECTORIES_API_PATH}?${url.searchParams.toString()}`,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return [];
    }

    const directories = await response.json().catch((e) => {
      this.logError(
        `${DIRECTORIES_API_PATH}?${url.searchParams.toString()}`,
        e,
      );
      return null;
    });

    return (directories ?? []) as DirectoryReply[];
  }

  async get(
    id: string,
    query?: GetDirectoryQuery,
  ): Promise<DirectoryReply | undefined> {
    const urlPart = `${DIRECTORIES_API_PATH}/${encodeURIComponent(id)}`;

    const url = new URL(`${BACKEND_BASE}${urlPart}`);
    // Defaults match the canonical list call.
    url.searchParams.append(
      "include_parents",
      (query?.include_parents ?? true).toString(),
    );
    url.searchParams.append(
      "include_child_dirs",
      (query?.include_child_dirs ?? true).toString(),
    );
    url.searchParams.append(
      "include_child_notes",
      (query?.include_child_notes ?? false).toString(),
    );
    url.searchParams.append(
      "include_shelves",
      (query?.include_shelves ?? true).toString(),
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      this.logError(
        `${urlPart}?${url.searchParams.toString()}`,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      throw new UserError(
        "Failed to load directory",
        response.statusText || "Unknown error",
        response.status,
      );
    }

    const directory = await response.json().catch((e) => {
      this.logError(`${urlPart}?${url.searchParams.toString()}`, e);
      return null;
    });

    return directory ?? undefined;
  }

  async create(
    payload: CreateDirectoryBody,
  ): Promise<DirectoryReply | undefined> {
    return this.requestWithBody("POST", DIRECTORIES_API_PATH, payload);
  }

  async patch(
    payload: PatchDirectoryBody,
  ): Promise<DirectoryReply | undefined> {
    return this.requestWithBody("PATCH", DIRECTORIES_API_PATH, payload);
  }

  async setParent(
    id: string,
    parentIds: string[] | null,
  ): Promise<DirectoryReply | undefined> {
    return this.requestWithBody("PATCH", DIRECTORIES_API_PATH, {
      id,
      parent_ids: parentIds ?? undefined,
    });
  }

  async delete(id: string): Promise<DirectoryReply | undefined> {
    return this.requestWithoutBody("DELETE", `${DIRECTORIES_API_PATH}/${id}`);
  }

  /**
   * Lists notes in a directory. Hits `GET /api/directories/:id/notes`.
   *
   * The backend routes this path without a trailing slash; sending the
   * slashed variant triggers a 301 redirect whose response is missing the
   * CORS headers gin adds on real responses. The browser then refuses to
   * follow the redirect cross-origin.
   *
   * The returned payload is a `NotesReply`: it embeds every directory
   * and tag referenced by the returned notes so the client can resolve
   * labels without a follow-up fetch.
   */
  async listNotes(
    id: string,
    query?: ListDirectoryNotesQuery,
  ): Promise<NotesReply> {
    const urlPart = `${DIRECTORIES_API_PATH}/${encodeURIComponent(id)}/notes`;

    const url = new URL(`${BACKEND_BASE}${urlPart}`);
    if (query?.limit !== undefined) {
      url.searchParams.append("limit", query.limit.toString());
    }
    if (query?.offset !== undefined) {
      url.searchParams.append("offset", query.offset.toString());
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      this.logError(
        `${urlPart}?${url.searchParams.toString()}`,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return { notes: [], directories: [], tags: [] };
    }

    const payload = await response.json().catch((e) => {
      this.logError(`${urlPart}?${url.searchParams.toString()}`, e);
      return null;
    });

    if (!payload) {
      return { notes: [], directories: [], tags: [] };
    }

    return {
      notes: payload.notes ?? [],
      directories: payload.directories ?? [],
      tags: payload.tags ?? [],
    };
  }

  private async requestWithBody(
    method: "POST" | "PATCH",
    urlPart: string,
    payload: CreateDirectoryBody | PatchDirectoryBody,
  ): Promise<DirectoryReply | undefined> {
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method,
      credentials: "include",
      headers: await this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.logError(
        urlPart,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const directory = await response.json().catch((e) => {
      this.logError(urlPart, e);
      return null;
    });

    return directory ?? undefined;
  }

  private async requestWithoutBody(
    method: "DELETE",
    urlPart: string,
  ): Promise<DirectoryReply | undefined> {
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method,
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      this.logError(
        urlPart,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const directory = await response.json().catch((e) => {
      this.logError(urlPart, e);
      return null;
    });

    return directory ?? undefined;
  }
}

// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const directoryApiSingleton = new DirectoryApi();
apiRegistry.register(directoryApiSingleton);

/**
 * Typed token for retrieving the registered `DirectoryApi` singleton from
 * the registry. Prefer the `getDirectoryApi()` helper over calling
 * `apiRegistry.get(DIRECTORY_API_TOKEN)` directly.
 */
export const DIRECTORY_API_TOKEN: ApiToken<DirectoryApi> = Symbol(
  "DirectoryApi",
) as ApiToken<DirectoryApi>;

// Register the SAME instance under the typed token too - see above.
apiRegistry.register(directoryApiSingleton, DIRECTORY_API_TOKEN);

/**
 * Resolve the registered `DirectoryApi` singleton.
 *
 * Throws if the API isn't registered — see `getNoteApi` for rationale.
 */
export function getDirectoryApi(): DirectoryApi {
  return apiRegistry.get<DirectoryApi>(DIRECTORY_API_TOKEN);
}
