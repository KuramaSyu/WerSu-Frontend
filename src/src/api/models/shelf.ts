/**
 * Shelf types - request/response shapes for the authenticated
 * shelf-management REST endpoints mounted under `/api/shelves`
 * (CRUD + book bindings). The bootstrap result returned by
 * `POST /api/shelves` lives here so callers can show the
 * `bootstrap_result.description` text in a snackbar.
 */

/**
 * Reply shape for a single shelf row returned by
 * `GET /api/shelves`, `GET /api/shelves/:id`,
 * `POST /api/shelves`, `PATCH /api/shelves`, and
 * `POST /api/shelves/by-ids`.
 *
 * `book_ids` is only populated when the corresponding request
 * passed `include_books=true`.
 */
export interface ShelfReply {
  id: string;
  slug?: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  readme_note_id?: string;
  book_ids?: string[];
}

/**
 * Body for `POST /api/shelves` - create a new shelf.
 * `slug` is required; everything else is optional. Passing
 * `bootstrap_strategy` runs a bootstrap (e.g. zettelkasten) right
 * after insert and the result lands in `bootstrap_result`.
 */
export interface CreateShelfBody {
  slug: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  readme_note_id?: string;
  bootstrap_strategy?: string;
}

/**
 * Body for `PATCH /api/shelves` - update an existing shelf.
 * `id` is required; every other field is optional and only
 * forwarded when defined.
 */
export interface UpdateShelfBody {
  id: string;
  slug?: string;
  display_name?: string;
  description?: string;
  image_url?: string;
  readme_note_id?: string;
}

/**
 * Body for `DELETE /api/shelves` - delete a shelf.
 * Set `dry=true` to preview the would-be cascade without
 * deleting (returns the same `DeleteShelfReply`).
 */
export interface DeleteShelfBody {
  id: string;
  dry?: boolean;
}

/**
 * Reply for `DELETE /api/shelves`. When `dry=true` the shelf is
 * NOT deleted; the `affected_book_ids` still list what would be
 * detached.
 */
export interface DeleteShelfReply {
  affected_book_ids?: string[];
  binding_count?: number;
  dry?: boolean;
}

/**
 * Reply for `POST /api/shelves`. Carries the new shelf plus
 * the optional `bootstrap_result` when a `bootstrap_strategy`
 * was supplied at create time.
 */
export interface CreateShelfReply {
  shelf: ShelfReply;
  bootstrap_result?: BootstrapResultReply;
}

/**
 * Optional result of running a `bootstrap_strategy` during
 * shelf creation. Shows up under `CreateShelfReply.bootstrap_result`
 * when the create call asked for a bootstrap.
 */
export interface BootstrapResultReply {
  description?: string;
  created_directory_ids?: string[];
  created_rule_id?: string;
}

/**
 * Query for `GET /api/shelves` and `GET /api/shelves/:id`.
 * `include_books=true` makes the backend fill `book_ids` on
 * every row; defaults to `false` server-side.
 */
export interface ListShelvesQuery {
  limit?: number;
  offset?: number;
  include_books?: boolean;
}

/** Reply for `GET /api/shelves/:id/books` and the
 *  `GET /api/shelves/by-book?book_id=...` route. */
export interface BookIdsReply {
  book_ids: string[];
}

export interface ShelfIdsReply {
  shelf_ids: string[];
}

/** Body for `PUT /api/shelves/books` - replace the set of books
 *  bound to a shelf. */
export interface SetBooksBody {
  shelf_id: string;
  book_ids: string[];
}

/** Body for `POST /api/shelves/books/attach`. */
export interface AttachBookBody {
  shelf_id: string;
  book_id: string;
}

/** Body for `POST /api/shelves/books/detach`. */
export interface DetachBookBody {
  shelf_id: string;
  book_id: string;
}

/** Body for `POST /api/shelves/by-ids` - fetch multiple shelves
 *  in a single request. */
export interface GetShelvesBody {
  ids: string[];
  include_books?: boolean;
}

export type GetShelvesByIdsEndpointRequest = GetShelvesBody;
export type GetShelvesByIdsEndpointReply = ShelfReply[];

export type ListShelvesEndpointRequest = ListShelvesQuery;
export type ListShelvesEndpointReply = ShelfReply[];

export type CreateShelfEndpointRequest = CreateShelfBody;
export type CreateShelfEndpointReply = CreateShelfReply;

export type UpdateShelfEndpointRequest = UpdateShelfBody;
export type UpdateShelfEndpointReply = ShelfReply;

export type DeleteShelfEndpointRequest = DeleteShelfBody;
export type DeleteShelfEndpointReply = DeleteShelfReply;

export type GetShelfByIdEndpointRequest = { id: string; include_books?: boolean };
export type GetShelfByIdEndpointReply = ShelfReply;

export type GetShelfBooksEndpointRequest = { id: string };
export type GetShelfBooksEndpointReply = BookIdsReply;

export type GetShelvesByBookEndpointRequest = { book_id: string };
export type GetShelvesByBookEndpointReply = ShelfIdsReply;

export type SetShelfBooksEndpointRequest = SetBooksBody;
export type SetShelfBooksEndpointReply = void;

export type AttachBookEndpointRequest = AttachBookBody;
export type AttachBookEndpointReply = void;

export type DetachBookEndpointRequest = DetachBookBody;
export type DetachBookEndpointReply = void;
