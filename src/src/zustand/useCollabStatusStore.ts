import { create } from "zustand";

/**
 * Lifecycle state of the Hocuspocus WebSocket for the currently-open note.
 *
 *   - `idle`            — no provider yet (no `noteId`, or `editMode` is off).
 *   - `awaitingToken`   — provider would exist but the JWT isn't in the
 *                         auth store yet. Without this state we'd show
 *                         "Offline" while waiting for `/api/auth/access-token`.
 *   - `tokenFetchError` — `/api/auth/access-token` rejected. Distinct
 *                         from `disconnected` so the tooltip can suggest
 *                         "re-login" rather than "network down".
 *   - `connecting` / `connected` / `authFailed` / `disconnected` —
 *                         mirror Hocuspocus's `WebSocketStatus` plus
 *                         auth-specific failure.
 */
export type CollabStatus =
  | "idle"
  | "awaitingToken"
  | "tokenFetchError"
  | "connecting"
  | "connected"
  | "authFailed"
  | "disconnected";

/** Per-note diagnostic surfaced in the badge tooltip. */
export interface CollabDiagnostic {
  message?: string;
  lastAuthReason?: string;
  tokenFetchError?: string;
  /** Timestamp (ms since epoch) of the most recent status change. */
  since?: number;
  authFailures?: number;
}

interface CollabStatusState {
  byNoteId: Record<string, CollabStatus>;
  diagnostics: Record<string, CollabDiagnostic>;

  setStatus: (noteId: string, status: CollabStatus, message?: string) => void;
  setAuthFailed: (noteId: string, reason?: string) => void;
  setTokenFetchError: (noteId: string, error: unknown) => void;
  clearNote: (noteId: string) => void;
}

const EMPTY_DIAGNOSTIC: CollabDiagnostic = {};

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const collabStatusStore = create<CollabStatusState>((set) => ({
  byNoteId: {},
  diagnostics: {},
  setStatus: (noteId, status, message) =>
    set((state) => {
      const prev = state.diagnostics[noteId] ?? EMPTY_DIAGNOSTIC;
      // Reset transient diagnostics when we land in a "fresh" state.
      const resetTransient =
        status === "connected" ||
        status === "awaitingToken" ||
        status === "idle";
      return {
        byNoteId: { ...state.byNoteId, [noteId]: status },
        diagnostics: {
          ...state.diagnostics,
          [noteId]: {
            message: message ?? prev.message,
            lastAuthReason:
              status === "authFailed" ? prev.lastAuthReason : undefined,
            tokenFetchError: resetTransient ? undefined : prev.tokenFetchError,
            since: Date.now(),
            authFailures: resetTransient ? 0 : (prev.authFailures ?? 0),
          },
        },
      };
    }),
  setAuthFailed: (noteId, reason) =>
    set((state) => {
      const prev = state.diagnostics[noteId] ?? EMPTY_DIAGNOSTIC;
      return {
        byNoteId: { ...state.byNoteId, [noteId]: "authFailed" },
        diagnostics: {
          ...state.diagnostics,
          [noteId]: {
            message: "Server rejected the authentication token.",
            lastAuthReason: reason,
            since: Date.now(),
            authFailures: (prev.authFailures ?? 0) + 1,
          },
        },
      };
    }),
  setTokenFetchError: (noteId, error) =>
    set((state) => {
      const prev = state.diagnostics[noteId] ?? EMPTY_DIAGNOSTIC;
      // Keep "connected" sticky; otherwise surface the error in the badge.
      const nextStatus =
        state.byNoteId[noteId] === "connected"
          ? "connected"
          : "tokenFetchError";
      return {
        byNoteId: { ...state.byNoteId, [noteId]: nextStatus },
        diagnostics: {
          ...state.diagnostics,
          [noteId]: {
            message:
              "Couldn't fetch an access token from the backend. Check Network → /api/auth/access-token.",
            tokenFetchError: stringifyError(error),
            since: Date.now(),
            authFailures: prev.authFailures ?? 0,
          },
        },
      };
    }),
  clearNote: (noteId) =>
    set((state) => {
      const nextStatus = { ...state.byNoteId };
      const nextDiag = { ...state.diagnostics };
      delete nextStatus[noteId];
      delete nextDiag[noteId];
      return { byNoteId: nextStatus, diagnostics: nextDiag };
    }),
}));

export function useCollabStatus(noteId: string | undefined): CollabStatus {
  return collabStatusStore((state) =>
    noteId ? (state.byNoteId[noteId] ?? "idle") : "idle",
  );
}

export function useCollabDiagnostic(
  noteId: string | undefined,
): CollabDiagnostic {
  return collabStatusStore(
    (state) =>
      (noteId ? state.diagnostics[noteId] : undefined) ?? EMPTY_DIAGNOSTIC,
  );
}
