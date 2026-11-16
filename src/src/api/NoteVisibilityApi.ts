/*
  REST client for `/api/visibility`.

  The backend endpoint does not exist yet. This module defines the wire
  contract and the `NoteVisibilityApi` interface the rest of the app uses,
  so the REST client can later be replaced with a direct backend bridge.

  Endpoints:
    GET    /api/visibility  -> NoteVisibilityEntry[]
    POST   /api/visibility  -> NoteVisibilityEntry
    DELETE /api/visibility  -> { success: boolean }
*/

import { BACKEND_BASE } from "../statics";
import type {
  HideVisibilityOptions,
  HideVisibilityRequest,
  NoteVisibilityApi as INoteVisibilityApi,
  NoteVisibilityEntry,
  NoteVisibilityTarget,
  UnhideVisibilityReply,
  UnhideVisibilityRequest,
} from "./models/noteVisibility";
import { resolveVisibilityExpiry } from "./models/noteVisibility";
import { requestJson } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/** Path shared by every visibility endpoint. */
const VISIBILITY_PATH = "/api/visibility";

/** List payloads may come back bare or wrapped; accept both. */
function normaliseList(reply: unknown): NoteVisibilityEntry[] {
  if (Array.isArray(reply)) {
    return reply as NoteVisibilityEntry[];
  }
  if (reply && typeof reply === "object") {
    const entries = (reply as { entries?: unknown }).entries;
    if (Array.isArray(entries)) {
      return entries as NoteVisibilityEntry[];
    }
  }
  return [];
}

/** Single-entry payloads may be wrapped as a one-item list. */
function normaliseEntry(reply: unknown): NoteVisibilityEntry {
  const entries = normaliseList(reply);
  if (entries.length > 0) {
    return entries[0];
  }
  return reply as NoteVisibilityEntry;
}

/** Build a hide request, enforcing exactly one target kind. */
export function buildHideVisibilityRequest(
  target: NoteVisibilityTarget,
  scope: number,
  options?: HideVisibilityOptions,
): HideVisibilityRequest {
  const expires_at = resolveVisibilityExpiry(options);
  return {
    ...(target.kind === "note"
      ? { note_id: target.id }
      : { directory_id: target.id }),
    scope,
    ...(expires_at ? { expires_at } : {}),
  };
}

/** Abstract base class so tests and future backends can substitute the REST client. */
export abstract class AbstractNoteVisibilityApi implements INoteVisibilityApi {
  abstract list(): Promise<NoteVisibilityEntry[]>;
  abstract hideNote(
    noteId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry>;
  abstract hideDirectory(
    directoryId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry>;
  abstract hide(
    target: NoteVisibilityTarget,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry>;
  abstract unhide(request?: UnhideVisibilityRequest): Promise<boolean>;
}

/** REST implementation backed by `/api/visibility`. */
export class RestNoteVisibilityApi extends AbstractNoteVisibilityApi {
  async list(): Promise<NoteVisibilityEntry[]> {
    const reply = await requestJson<unknown>(
      `${BACKEND_BASE}${VISIBILITY_PATH}`,
      { method: "GET" },
    );
    return normaliseList(reply);
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
    const body = buildHideVisibilityRequest(target, scope, options);
    const reply = await requestJson<unknown>(
      `${BACKEND_BASE}${VISIBILITY_PATH}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return normaliseEntry(reply);
  }

  async unhide(request?: UnhideVisibilityRequest): Promise<boolean> {
    const reply = await requestJson<UnhideVisibilityReply>(
      `${BACKEND_BASE}${VISIBILITY_PATH}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request ?? { all: true }),
      },
    );
    return reply?.success === true;
  }
}

/** Shared singleton used by the store and settings UI. */
export const noteVisibilityApi: INoteVisibilityApi =
  new RestNoteVisibilityApi();

apiRegistry.register(noteVisibilityApi);
export const NOTE_VISIBILITY_API_TOKEN: ApiToken<INoteVisibilityApi> =
  Symbol("NoteVisibilityApi") as ApiToken<INoteVisibilityApi>;
apiRegistry.register(noteVisibilityApi, NOTE_VISIBILITY_API_TOKEN);

/** Resolve the registered visibility API. Throws when it is not registered. */
export function getNoteVisibilityApi(): INoteVisibilityApi {
  return apiRegistry.get<INoteVisibilityApi>(NOTE_VISIBILITY_API_TOKEN);
}