import { BACKEND_BASE } from "../statics";
import type {
  CreateDirectoryBody,
  DirectoryReply,
  PatchDirectoryBody,
} from "./models/directory.ts";
import { ShareTokenBearerMixin } from "./shareToken";
import { apiRegistry, type ApiToken } from "./apiRegistry";

const DIRECTORIES_API_PATH = "/api/directories";

export interface ListDirectoriesQuery {
  parent_id?: string;
  limit?: number;
  offset?: number;
}

export interface IDirectoryApi {
  list(query?: ListDirectoriesQuery): Promise<DirectoryReply[]>;
  get(id: string): Promise<DirectoryReply | undefined>;
  create(payload: CreateDirectoryBody): Promise<DirectoryReply | undefined>;
  patch(payload: PatchDirectoryBody): Promise<DirectoryReply | undefined>;
  setParent(
    id: string,
    parentId: string | null,
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

  async get(id: string): Promise<DirectoryReply | undefined> {
    const urlPart = `${DIRECTORIES_API_PATH}/${id}`;

    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method: "GET",
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
    parentId: string | null,
  ): Promise<DirectoryReply | undefined> {
    return this.requestWithBody("PATCH", DIRECTORIES_API_PATH, {
      id,
      parent_id: parentId,
    });
  }

  async delete(id: string): Promise<DirectoryReply | undefined> {
    return this.requestWithoutBody("DELETE", `${DIRECTORIES_API_PATH}/${id}`);
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
