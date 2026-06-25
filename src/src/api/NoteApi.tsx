import { BACKEND_BASE } from "../statics";
import { Note, type NoteData } from "./models/search";
import { UserError } from "./models/UserError";
import { PermissionsApi } from "./PermissionsApi";
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
   * Returns the headers object for a request, merged with the share-token
   * `Authorization` header when one is currently injected. Always `await` —
   * the provider may be async.
   */
  private async authHeaders(
    base: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    return { ...base, ...(await this.resolveShareAuthHeader()) };
  }

  /**
   * tries to authenticate a user by coockie.
   * It sets `useUserStore` to the authenticated user
   * */
  async get(id: string): Promise<Note | undefined> {
    const response = await fetch(`${BACKEND_BASE}/api/notes/${id}`, {
      method: "GET",
      credentials: "include",
      headers: await this.authHeaders(),
    });
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
      {
        method: "GET",
        credentials: "include",
        headers: await this.authHeaders(),
      },
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
      method: "POST",
      credentials: "include",
      headers: await this.authHeaders({ "Content-Type": "application/json" }),
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
      method: "PATCH",
      credentials: "include",
      headers: await this.authHeaders({ "Content-Type": "application/json" }),
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
    const permissionsApi = new PermissionsApi();
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
    const response = await fetch(`${BACKEND_BASE}/api/notes/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: await this.authHeaders(),
    });
    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to delete note");
    }
    if (response.ok) {
      return true;
    }
    throw new Error("Failed to delete note");
  }
}

// Register the default singleton so `apiRegistry.installShareTokenProvider(...)`
// reaches it. Consumers that create their own `NoteApi` instances should call
// `apiRegistry.register(instance)` themselves.
apiRegistry.register(new NoteApi());

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

// Re-register the same instance under the typed token so both retrieval
// styles work:
apiRegistry.register(new NoteApi(), NOTE_API_TOKEN);

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
