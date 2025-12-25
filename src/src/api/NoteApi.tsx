import { BACKEND_BASE } from '../statics';
import { useNotesStore } from '../zustand/useNotesStore';
import type { Note } from './models/search';

export interface INoteApi {
  get(id: number): Promise<Note | undefined>;
}

// represents the backend methods, which are needed for user purposes
export class NoteApi implements INoteApi {
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
  async get(id: number): Promise<Note | undefined> {
    const updateNote = useNotesStore.getState().updateNote;
    const response = await fetch(`${BACKEND_BASE}/api/notes/${id}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (response.ok) {
      const note: Note = await response.json().catch((e) => {
        this.logError(`/api/notes/${id}`, e);
        return null;
      });
      updateNote(note);
      return note;
    }
    return undefined;
  }

  async post(title: string, content: string): Promise<Note | undefined> {
    const updateNote = useNotesStore.getState().updateNote;
    const response = await fetch(`${BACKEND_BASE}/api/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });
    if (response.ok) {
      const note: Note = await response.json().catch((e) => {
        this.logError(`/api/notes`, e);
        return null;
      });
      updateNote(note);
      return note;
    }
    return undefined;
  }
}
