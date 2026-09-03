/*
  Shelf REST client for the GoToHell API.

  Mirrors the `/api/shelves` surface defined in
  `WerSuDeF-Rest-Api/src/docs/swagger.json`. The shape follows
  the same `AbstractShelfApi` / `RestShelfApi` split used by
  `SharingApi`: tests can swap the implementation without
  touching the call sites, and `requestJson` handles error
  parsing uniformly.
*/

import { BACKEND_BASE } from "../statics";
import type {
  AttachBookEndpointReply,
  AttachBookEndpointRequest,
  CreateShelfEndpointReply,
  CreateShelfEndpointRequest,
  DeleteShelfEndpointReply,
  DeleteShelfEndpointRequest,
  DetachBookEndpointReply,
  DetachBookEndpointRequest,
  GetShelfBooksEndpointReply,
  GetShelfBooksEndpointRequest,
  GetShelfByIdEndpointReply,
  GetShelfByIdEndpointRequest,
  GetShelvesByBookEndpointReply,
  GetShelvesByBookEndpointRequest,
  GetShelvesByIdsEndpointReply,
  GetShelvesByIdsEndpointRequest,
  ListShelvesEndpointReply,
  ListShelvesEndpointRequest,
  SetShelfBooksEndpointReply,
  SetShelfBooksEndpointRequest,
  UpdateShelfEndpointReply,
  UpdateShelfEndpointRequest,
} from "./models/shelf";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * REST surface for the authenticated shelf-management endpoints.
 * Implementation lives in :class:`RestShelfApi`; tests and plugin
 * code can pass an alternative implementation through the
 * registry.
 */
export interface ShelfApi {
  /** List shelves with optional pagination and book-id inclusion. */
  listShelves(
    request: ListShelvesEndpointRequest,
  ): Promise<ListShelvesEndpointReply>;

  /** Fetch a single shelf by ID. */
  getShelfById(
    request: GetShelfByIdEndpointRequest,
  ): Promise<GetShelfByIdEndpointReply>;

  /** Create one shelf; optionally runs a `bootstrap_strategy`. */
  createShelf(
    request: CreateShelfEndpointRequest,
  ): Promise<CreateShelfEndpointReply>;

  /** Update one shelf. */
  updateShelf(
    request: UpdateShelfEndpointRequest,
  ): Promise<UpdateShelfEndpointReply>;

  /**
   * Delete one shelf. Set `request.dry=true` to preview the
   * would-be cascade without deleting; the reply still reports
   * `affected_book_ids` and `binding_count`.
   */
  deleteShelf(
    request: DeleteShelfEndpointRequest,
  ): Promise<DeleteShelfEndpointReply>;

  /** List the book ids bound to a shelf. */
  getShelfBooks(
    request: GetShelfBooksEndpointRequest,
  ): Promise<GetShelfBooksEndpointReply>;

  /** Resolve the shelves a book sits on. */
  getShelvesByBook(
    request: GetShelvesByBookEndpointRequest,
  ): Promise<GetShelvesByBookEndpointReply>;

  /** Fetch multiple shelves by ID in a single request. */
  getShelvesByIds(
    request: GetShelvesByIdsEndpointRequest,
  ): Promise<GetShelvesByIdsEndpointReply>;

  /** Replace the set of books bound to a shelf. */
  setShelfBooks(
    request: SetShelfBooksEndpointRequest,
  ): Promise<SetShelfBooksEndpointReply>;

  /** Attach a single book to a shelf. */
  attachBook(
    request: AttachBookEndpointRequest,
  ): Promise<AttachBookEndpointReply>;

  /** Detach a single book from a shelf. */
  detachBook(
    request: DetachBookEndpointRequest,
  ): Promise<DetachBookEndpointReply>;
}

export abstract class AbstractShelfApi implements ShelfApi {
  abstract listShelves(
    request: ListShelvesEndpointRequest,
  ): Promise<ListShelvesEndpointReply>;
  abstract getShelfById(
    request: GetShelfByIdEndpointRequest,
  ): Promise<GetShelfByIdEndpointReply>;
  abstract createShelf(
    request: CreateShelfEndpointRequest,
  ): Promise<CreateShelfEndpointReply>;
  abstract updateShelf(
    request: UpdateShelfEndpointRequest,
  ): Promise<UpdateShelfEndpointReply>;
  abstract deleteShelf(
    request: DeleteShelfEndpointRequest,
  ): Promise<DeleteShelfEndpointReply>;
  abstract getShelfBooks(
    request: GetShelfBooksEndpointRequest,
  ): Promise<GetShelfBooksEndpointReply>;
  abstract getShelvesByBook(
    request: GetShelvesByBookEndpointRequest,
  ): Promise<GetShelvesByBookEndpointReply>;
  abstract getShelvesByIds(
    request: GetShelvesByIdsEndpointRequest,
  ): Promise<GetShelvesByIdsEndpointReply>;
  abstract setShelfBooks(
    request: SetShelfBooksEndpointRequest,
  ): Promise<SetShelfBooksEndpointReply>;
  abstract attachBook(
    request: AttachBookEndpointRequest,
  ): Promise<AttachBookEndpointReply>;
  abstract detachBook(
    request: DetachBookEndpointRequest,
  ): Promise<DetachBookEndpointReply>;
}

export class RestShelfApi extends AbstractShelfApi {
  async listShelves(
    request: ListShelvesEndpointRequest,
  ): Promise<ListShelvesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves${toQueryString(request)}`;
    return await requestJson<ListShelvesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getShelfById(
    request: GetShelfByIdEndpointRequest,
  ): Promise<GetShelfByIdEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/${encodeURIComponent(request.id)}${toQueryString({
      include_books: request.include_books,
    })}`;
    return await requestJson<GetShelfByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async createShelf(
    request: CreateShelfEndpointRequest,
  ): Promise<CreateShelfEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves`;
    return await requestJson<CreateShelfEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async updateShelf(
    request: UpdateShelfEndpointRequest,
  ): Promise<UpdateShelfEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves`;
    return await requestJson<UpdateShelfEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async deleteShelf(
    request: DeleteShelfEndpointRequest,
  ): Promise<DeleteShelfEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves`;
    return await requestJson<DeleteShelfEndpointReply>(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async getShelfBooks(
    request: GetShelfBooksEndpointRequest,
  ): Promise<GetShelfBooksEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/${encodeURIComponent(request.id)}/books`;
    return await requestJson<GetShelfBooksEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getShelvesByBook(
    request: GetShelvesByBookEndpointRequest,
  ): Promise<GetShelvesByBookEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/by-book${toQueryString({
      book_id: request.book_id,
    })}`;
    return await requestJson<GetShelvesByBookEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getShelvesByIds(
    request: GetShelvesByIdsEndpointRequest,
  ): Promise<GetShelvesByIdsEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/by-ids`;
    return await requestJson<GetShelvesByIdsEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async setShelfBooks(
    request: SetShelfBooksEndpointRequest,
  ): Promise<SetShelfBooksEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/books`;
    await requestJson<void>(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return;
  }

  async attachBook(
    request: AttachBookEndpointRequest,
  ): Promise<AttachBookEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/books/attach`;
    await requestJson<void>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return;
  }

  async detachBook(
    request: DetachBookEndpointRequest,
  ): Promise<DetachBookEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shelves/books/detach`;
    await requestJson<void>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return;
  }
}

export const shelfApi: ShelfApi = new RestShelfApi();

// Register the concrete REST singleton under a typed token so consumers
// can resolve it via `getShelfApi()`. The bare `shelfApi` export above
// stays for backward compatibility with the rest of the call sites.
apiRegistry.register(shelfApi as RestShelfApi);
export const SHELF_API_TOKEN: ApiToken<RestShelfApi> = Symbol(
  "RestShelfApi",
) as ApiToken<RestShelfApi>;
apiRegistry.register(shelfApi as RestShelfApi, SHELF_API_TOKEN);

/**
 * Resolve the registered `RestShelfApi` singleton.
 *
 * Throws if the API isn't registered - see `getNoteApi` for rationale.
 */
export function getShelfApi(): RestShelfApi {
  return apiRegistry.get<RestShelfApi>(SHELF_API_TOKEN);
}
