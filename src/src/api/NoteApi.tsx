import { BACKEND_BASE } from "../statics";
import { useNotesStore } from "../zustand/useNotesStore";
import { Note, type NoteData } from "./models/search";
import { PermissionsApi } from "./PermissionsApi";

export interface INoteApi {
  get(id: string): Promise<Note | undefined>;
  post(title: string, content: string): Promise<Note | undefined>;
  patch(
    id: string,
    title?: string,
    content?: string,
  ): Promise<Note | undefined>;
  patchDirectory(id: string, directoryId?: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

// represents the backend methods, which are needed for user purposes
export class NoteApi implements INoteApi {
  logError(url_part: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${url_part}:`,
      JSON.stringify(error),
    );
  }

  /**
   * tries to authenticate a user by coockie.
   * It sets `useUserStore` to the authenticated user
   * */
  async get(id: string): Promise<Note | undefined> {
    const updateNote = useNotesStore.getState().updateNote;
    const response = await fetch(`${BACKEND_BASE}/api/notes/${id}`, {
      method: "GET",
      credentials: "include",
    });
    if (response.ok) {
      const noteData: NoteData = await response.json().catch((e) => {
        this.logError(`/api/notes/${id}`, e);
        return null;
      });
      if (noteData === null) {
        return undefined;
      }
      const note = Note.fromJson(noteData);
      updateNote(note);
      return note;
    }
    return undefined;
  }

  async post(title: string, content: string): Promise<Note | undefined> {
    const updateNote = useNotesStore.getState().updateNote;
    const response = await fetch(`${BACKEND_BASE}/api/notes`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, content }),
    });
    if (response.ok) {
      const noteData: NoteData = await response.json().catch((e) => {
        this.logError(`/api/notes`, e);
        return null;
      });
      if (noteData === null) {
        return undefined;
      }
      const note = Note.fromJson(noteData);
      updateNote(note);
      return note;
    }
    return undefined;
  }

  async patch(
    id: string,
    title?: string,
    content?: string,
  ): Promise<Note | undefined> {
    const updateNote = useNotesStore.getState().updateNote;
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const noteData: NoteData = await response.json().catch((e) => {
        this.logError(`/api/notes`, e);
        return null;
      });
      if (noteData === null) {
        return undefined;
      }
      const note = Note.fromJson(noteData);
      updateNote(note);
      return note;
    }
    return undefined;
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
    const removeNote = useNotesStore.getState().removeNote;
    const response = await fetch(`${BACKEND_BASE}/api/notes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      removeNote(id);
      return true;
    }
    return false;
  }
}
