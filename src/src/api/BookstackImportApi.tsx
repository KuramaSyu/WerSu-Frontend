import { BACKEND_BASE } from "../statics";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * Per-chapter import stats returned by the BookStack import endpoint.
 *
 * Mirrors the gRPC `BookstackImportedChapter` message but with plain
 * Go types (no protobuf wrappers) so JSON serialization is direct.
 */
export interface BookstackImportedChapter {
  /** id of the directory created for this chapter. */
  directory_id: string;
  /** display name of the chapter as it appeared in the zip. */
  chapter_name: string;
  /** how many pages of the chapter were imported. */
  pages_imported: number;
}

/**
 * Reply shape for `POST /api/migrations/import_bookstack_book`.
 *
 * `pages_imported` and `attachments_uploaded` are included even when
 * zero so callers can tell at a glance what the import produced.
 */
export interface BookstackBookImportReply {
  /** id of the directory created for the imported book's root. */
  book_directory_id: string;
  /** per-chapter import stats, one entry per chapter in the zip. */
  chapters: BookstackImportedChapter[];
  /** total number of pages imported across the whole book. */
  pages_imported: number;
  /** total number of attachment files uploaded alongside the pages. */
  attachments_uploaded: number;
}

/**
 * Public surface for the BookStack import REST endpoint.
 */
export interface IBookstackImportApi {
  /**
   * Upload a BookStack book zip to the backend.
   *
   * The backend streams the file to the gRPC `BookstackBookImport`
   * RPC in 1 MiB chunks; the resolved promise delivers the same
   * reply shape the REST endpoint serializes, so callers can render
   * the resulting tree without a second round-trip.
   *
   * @param file the zip archive exported from a BookStack book.
   * @throws if the upload fails or the backend rejects the file
   * (status 4xx/5xx). The thrown `Error` carries the response body
   * when present so the UI can surface a useful message.
   */
  importBook(file: File): Promise<BookstackBookImportReply>;

  /**
   * Build the request init the API uses for a `POST /api/migrations/import_bookstack_book`
   * call without firing it. Used by tests to assert wire shape.
   */
  requestInitForImportBook(file: File): Promise<{
    url: string;
    init: RequestInit;
  }>;
}

/**
 * REST client for the third-party-migration endpoints (currently
 * BookStack). The endpoint is private and cookie-authenticated, so
 * requests always use `credentials: "include"`. It does NOT extend
 * `ShareTokenBearerMixin` because the share JWT does not grant
 * migration rights.
 */
export class BookstackImportApi implements IBookstackImportApi {
  /** Logs REST errors consistently to ease debugging. */
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  /** Backend path for the BookStack import endpoint. */
  static readonly MIGRATIONS_PATH = "/api/migrations/import_bookstack_book";

  /**
   * Builds the fetch init for `POST /api/migrations/import_bookstack_book`.
   *
   * The `file` is sent as `multipart/form-data` under the field name
   * `file`, matching the `c.FormFile("file")` lookup in the backend
   * controller.
   */
  async requestInitForImportBook(file: File): Promise<{
    url: string;
    init: RequestInit;
  }> {
    const formData = new FormData();
    formData.append("file", file);

    return {
      url: `${BACKEND_BASE}${BookstackImportApi.MIGRATIONS_PATH}`,
      init: {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    };
  }

  /**
   * Uploads a BookStack book zip and resolves with the import
   * stats returned by the backend.
   */
  async importBook(file: File): Promise<BookstackBookImportReply> {
    const { url, init } = await this.requestInitForImportBook(file);
    const response = await fetch(url, init);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      this.logError(
        BookstackImportApi.MIGRATIONS_PATH,
        `Response not ok: ${response.status}; ${response.statusText}; ${body}`,
      );
      throw new Error(
        `BookStack import failed (${response.status}): ${body || response.statusText}`,
      );
    }

    const payload = (await response.json().catch((e) => {
      this.logError(BookstackImportApi.MIGRATIONS_PATH, e);
      return null;
    })) as BookstackBookImportReply | null;

    if (payload === null) {
      throw new Error("BookStack import returned an empty response body");
    }

    return payload;
  }
}

// Register the default singleton + a typed token so consumers can
// resolve it via `getBookstackImportApi()`.
//
// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const bookstackImportApiSingleton = new BookstackImportApi();
apiRegistry.register(bookstackImportApiSingleton);
export const BOOKSTACK_IMPORT_API_TOKEN: ApiToken<BookstackImportApi> = Symbol(
  "BookstackImportApi",
) as ApiToken<BookstackImportApi>;
apiRegistry.register(bookstackImportApiSingleton, BOOKSTACK_IMPORT_API_TOKEN);

/**
 * Resolve the registered `BookstackImportApi` singleton.
 *
 * Throws if the API isn't registered - see `getNoteApi` for rationale.
 */
export function getBookstackImportApi(): BookstackImportApi {
  return apiRegistry.get<BookstackImportApi>(BOOKSTACK_IMPORT_API_TOKEN);
}
