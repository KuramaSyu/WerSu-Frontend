import { BACKEND_BASE } from "../statics";
import { Note, type NoteData } from "./models/search";
import { UserError } from "./models/UserError";
import { getPermissionsApi } from "./PermissionsApi";
import { ShareTokenBearerMixin } from "./shareToken";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export interface INoteApi {
  get(id: string): Promise<Note | undefined>;
  /** Fetch a specific note version by its monotonic version index. */
  getVersion(id: string, versionIndex: number): Promise<Note | undefined>;
  post(title: string, content: string): Promise<Note>;
  patch(id: string, title?: string, content?: string): Promise<Note>;
  patchDirectory(id: string, directoryId?: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

// represents the backend methods, which are needed for user purposes.
//
// Extends `ShareTokenBearerMixin` so the API can attach an
// `Authorization: Bearer <share-jwt>` header to its outgoing requests when
// a public share is active. The provider is injected at runtime via the
// central `apiRegistry`; no provider => no share header is attached
// (default state for logged-in users).
export class NoteApi extends ShareTokenBearerMixin implements INoteApi {
  logError(url_part: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${url_part}:`,
      JSON.stringify(error),
    );
  }

  private async buildUserError(
    response: Response,
    title = "Request failed",
  ): Promise<UserError> {
    const description = await response.text().catch(() => "");
    return new UserError(
      title,
      description || response.statusText || "Unknown error",
      response.status,
    );
  }

  /**
   * Returns the full URL + fetch-init the API will use for a given
   * `GET /api/notes/:id` call. Used by the test surface in
   * `NoteApi.test.ts` to assert the wire shape without spinning up
   * jsdom or rendering React.
   */
  async requestInitForGet(
    id: string,
  ): Promise<{ url: string; init: RequestInit }> {
    return {
      url: `${BACKEND_BASE}/api/notes/${encodeURIComponent(id)}`,
      init: await this.getFetchParameters("GET"),
    };
  }

  /**
   * tries to authenticate a user by coockie.
   * It sets `useUserStore` to the authenticated user
   * */
  async get(id: string): Promise<Note | undefined> {
    const init = await this.getFetchParameters("GET");
    const headerObj = init.headers as Record<string, string> | undefined;
    console.debug(
      "[note-api] get() sending request - url=",
      `${BACKEND_BASE}/api/notes/${encodeURIComponent(id)}`,
      "method=",
      init.method,
      "credentials=",
      init.credentials,
      "headers=",
      headerObj,
    );
    const response = await fetch(
      `${BACKEND_BASE}/api/notes/${encodeURIComponent(id)}`,
      init,
    );
    console.debug(
      "[note-api] get() response - status=",
      response.status,
      "url=",
      response.url,
    );
    if (!response.ok) {
      throw await this.buildUserError(response);
    }
    if (response.ok) {
      const noteData: NoteData = await response.json().catch((e) => {
        this.logError(`/api/notes/${id}`, e);
        return null;
      });
      if (noteData === null) {
        return undefined;
      }
      const note = Note.fromJson(noteData);
      return note;
    }
    return undefined;
  }

  /**
   * Fetches a specific version of a note using the version index (not id).
   */
  async getVersion(
    id: string,
    versionIndex: number,
  ): Promise<Note | undefined> {
    const response = await fetch(
      `${BACKEND_BASE}/api/notes/${id}/versions/${versionIndex}`,
      await this.getFetchParameters("GET"),
    );
    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to load version");
    }

    const noteData: NoteData = await response.json().catch((e) => {
      this.logError(`/api/notes/${id}/versions/${versionIndex}`, e);
      return null;
    });
    if (noteData === null) {
      return undefined;
    }

    return Note.fromJson(noteData);
  }

  async post(title: string, content: string): Promise<Note> {
    const response = await fetch(`${BACKEND_BASE}/api/notes`, {
      ...(await this.getFetchParameters("POST", {
        "Content-Type": "application/json",
      })),
      body: JSON.stringify({ title, content }),
    });
    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to create note");
    }
    if (response.ok) {
      const noteData: NoteData = await response.json().catch((e) => {
        this.logError(`/api/notes`, e);
        throw new UserError(
          "Failed to create note",
          `Reason: ${JSON.stringify(e)}`,
          response.status,
        );
      });
      if (noteData === null) {
        throw new Error("Failed to create note");
      }
      console.log(`Created note: ${JSON.stringify(noteData)}`);
      const note = Note.fromJson(noteData);
      return note;
    }
    throw new Error("Failed to create note");
  }

  async patch(id: string, title?: string, content?: string): Promise<Note> {
    const body: { id: string; title?: string; content?: string } = { id };
    if (title !== undefined) {
      body.title = title;
    }
    if (content !== undefined) {
      body.content = content;
    }

    const response = await fetch(`${BACKEND_BASE}/api/notes`, {
      ...(await this.getFetchParameters("PATCH", {
        "Content-Type": "application/json",
      })),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to update note");
    }
    if (response.ok) {
      const noteData: NoteData = await response.json().catch((e) => {
        this.logError(`/api/notes`, e);
        return null;
      });
      if (noteData === null) {
        throw new Error("Failed to update note");
      }
      const note = Note.fromJson(noteData);
      return note;
    }
    throw new Error("Failed to update note");
  }

  /**
   * Reassigns a note to a directory by updating its `parent` permission
   * relationships. Passing `undefined` as `directoryId` moves the note to root.
   */
  async patchDirectory(id: string, directoryId?: string): Promise<boolean> {
    // Use the registered singleton so the share-token provider installed on
    // `Bootstrap` reaches this internal helper. See `useNoteQueries` for
    // rationale.
    const permissionsApi = getPermissionsApi();
    const existingPermissions = await permissionsApi.get("note", id);
    if (!existingPermissions) {
      this.logError(
        "/api/permissions",
        `Could not read permissions for note ${id}`,
      );
      return false;
    }

    const parentRelations = existingPermissions.relationships.filter(
      (relationship) => {
        const isParentRelation =
          relationship.relation === "parent" ||
          relationship.relation === "parent_directory";
        const isDirectorySubject =
          relationship.subject.object_type ===
          "PERMISSION_OBJECT_TYPE_DIRECTORY";
        return isParentRelation && isDirectorySubject;
      },
    );

    // Remove all existing directory parent links first to avoid duplicates.
    for (const relation of parentRelations) {
      const removed = await permissionsApi.delete({
        object_id: id,
        object_type: "note",
        relationship: {
          relation:
            relation.relation === "parent" ? "parent" : "parent_directory",
          resource: {
            object_id: id,
            object_type: "note",
          },
          subject: {
            object_id: relation.subject.object_id,
            object_type: "directory",
          },
        },
      });

      if (!removed) {
        return false;
      }
    }

    // Root drop means "no parent directory" after cleanup.
    if (!directoryId) {
      return true;
    }

    const created = await permissionsApi.post({
      object_id: id,
      object_type: "note",
      relationship: {
        relation: "parent_directory",
        resource: {
          object_id: id,
          object_type: "note",
        },
        subject: {
          object_id: directoryId,
          object_type: "directory",
        },
      },
    });

    return created !== undefined;
  }

  async delete(id: string): Promise<boolean> {
    const response = await fetch(
      `${BACKEND_BASE}/api/notes/${encodeURIComponent(id)}`,
      await this.getFetchParameters("DELETE"),
    );
    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to delete note");
    }
    if (response.ok) {
      return true;
    }
    throw new Error("Failed to delete note");
  }
}

// IMPORTANT: broadcast-set + typed-token must be the SAME instance,
// otherwise `installShareTokenProvider` doesn't reach the API the page
// actually uses (anonymous-public-page 401s). See the "Authorization
// header not found" backend log for the original bug.
const noteApiSingleton = new NoteApi();
apiRegistry.register(noteApiSingleton);

/**
 * Typed token for retrieving the registered `NoteApi` singleton from the
 * registry. Use the helper `getNoteApi()` rather than calling
 * `apiRegistry.get(NOTE_API_TOKEN)` directly — the helper is shorter and
 * lets us swap the resolution strategy later (e.g. lazy init) without
 * touching call sites.
 */
export const NOTE_API_TOKEN: ApiToken<NoteApi> = Symbol(
  "NoteApi",
) as ApiToken<NoteApi>;

// Register the SAME instance under the typed token too - see above.
apiRegistry.register(noteApiSingleton, NOTE_API_TOKEN);

/**
 * Resolve the registered `NoteApi` singleton.
 *
 * Throws if the API isn't registered — call sites shouldn't silently get
 * `undefined`, since that turns "auth header missing" into a runtime bug
 * that's painful to track down.
 */
export function getNoteApi(): NoteApi {
  return apiRegistry.get<NoteApi>(NOTE_API_TOKEN);
}
