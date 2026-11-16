/**
 * Local, in-process implementation of `NoteVisibilityApi`.
 *
 * This is the current default: every read and write goes straight through
 * the persisted zustand store, so the feature works without a backend
 * endpoint and survives reloads via localStorage. When the backend gains
 * `/api/visibility`, switch the registry back to `RestNoteVisibilityApi`.
 */

import {
  AbstractNoteVisibilityApi,
  NOTE_VISIBILITY_API_TOKEN,
} from "./NoteVisibilityApi";
import { apiRegistry } from "./apiRegistry";
import type {
  HideVisibilityOptions,
  NoteVisibilityApi,
  NoteVisibilityEntry,
  NoteVisibilityTarget,
  UnhideVisibilityRequest,
} from "./models/noteVisibility";
import {
  listVisibilityEntries,
  mergeVisibilityRule,
  removeVisibilityRule,
  resolveVisibilityExpiryLocal,
  ruleToEntry,
  useNoteVisibilityStore,
} from "../zustand/useNoteVisibilityStore";

/** Read the current target rule from a store snapshot. */
function currentEntry(
  target: NoteVisibilityTarget,
): NoteVisibilityEntry | undefined {
  const state = useNoteVisibilityStore.getState();
  const rule =
    target.kind === "note"
      ? state.notes[target.id]
      : state.directories[target.id];
  return rule ? ruleToEntry(target, rule) : undefined;
}

/** True when a rule would actually lose something for the requested scope. */
function removesRule(
  rule: { scope: number } | undefined,
  scope?: number,
): boolean {
  if (!rule) {
    return false;
  }
  return scope === undefined || (rule.scope & scope) !== 0;
}

/** Zustand + localStorage implementation of the visibility API. */
export class LocalNoteVisibilityApi
  extends AbstractNoteVisibilityApi
  implements NoteVisibilityApi
{
  async list(): Promise<NoteVisibilityEntry[]> {
    const state = useNoteVisibilityStore.getState();
    return listVisibilityEntries(state.notes, state.directories);
  }

  async hideNote(
    noteId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry> {
    return this.hide({ kind: "note", id: noteId }, scope, options);
  }

  async hideDirectory(
    directoryId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry> {
    return this.hide({ kind: "directory", id: directoryId }, scope, options);
  }

  async hide(
    target: NoteVisibilityTarget,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry> {
    const expiresAt = options
      ? resolveVisibilityExpiryLocal(options)
      : undefined;

    useNoteVisibilityStore.setState((state) =>
      target.kind === "note"
        ? {
            notes: mergeVisibilityRule(
              state.notes,
              target.id,
              scope,
              expiresAt,
            ),
          }
        : {
            directories: mergeVisibilityRule(
              state.directories,
              target.id,
              scope,
              expiresAt,
            ),
          },
    );

    const entry = currentEntry(target);
    if (!entry) {
      throw new Error("Failed to persist the visibility rule");
    }
    return entry;
  }

  async unhide(request?: UnhideVisibilityRequest): Promise<boolean> {
    const state = useNoteVisibilityStore.getState();
    const all = request === undefined || request.all === true;

    if (all) {
      const removed =
        Object.keys(state.notes).length > 0 ||
        Object.keys(state.directories).length > 0;
      useNoteVisibilityStore.setState({ notes: {}, directories: {} });
      return removed;
    }

    if (request.note_id === undefined && request.directory_id === undefined) {
      // A scope without a target clears that scope everywhere.
      if (request.scope === undefined) {
        return false;
      }
      const scope = request.scope;
      const notes = { ...state.notes };
      const directories = { ...state.directories };
      let removed = false;

      for (const [id, rule] of Object.entries(notes)) {
        if ((rule.scope & scope) === 0) {
          continue;
        }
        removed = true;
        const remaining = rule.scope & ~scope;
        if (remaining === 0) {
          delete notes[id];
        } else {
          notes[id] = { ...rule, scope: remaining };
        }
      }
      for (const [id, rule] of Object.entries(directories)) {
        if ((rule.scope & scope) === 0) {
          continue;
        }
        removed = true;
        const remaining = rule.scope & ~scope;
        if (remaining === 0) {
          delete directories[id];
        } else {
          directories[id] = { ...rule, scope: remaining };
        }
      }

      useNoteVisibilityStore.setState({ notes, directories });
      return removed;
    }

    const target: NoteVisibilityTarget =
      request.note_id !== undefined
        ? { kind: "note", id: request.note_id }
        : { kind: "directory", id: request.directory_id as string };
    const rules = target.kind === "note" ? state.notes : state.directories;
    const rule = rules[target.id];
    const removed = removesRule(rule, request.scope);

    useNoteVisibilityStore.setState((current) =>
      target.kind === "note"
        ? {
            notes: removeVisibilityRule(
              current.notes,
              target.id,
              request.scope,
            ),
          }
        : {
            directories: removeVisibilityRule(
              current.directories,
              target.id,
              request.scope,
            ),
          },
    );
    return removed;
  }
}

/** The singleton local implementation registered at app boot. */
export const localNoteVisibilityApi = new LocalNoteVisibilityApi();

/** Make the local implementation the active visibility API. */
export function installLocalNoteVisibilityApi(): void {
  apiRegistry.register(localNoteVisibilityApi, NOTE_VISIBILITY_API_TOKEN);
}