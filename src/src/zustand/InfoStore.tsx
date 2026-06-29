import { create } from "zustand";

export interface SnackbarUpdate {
  message: string;
  severity: "success" | "info" | "warning" | "error";
  duration?: number;
  description?: string;
}

export class SnackbarUpdateImpl implements SnackbarUpdate {
  message: string;
  severity: "success" | "info" | "warning" | "error";
  duration?: number;
  description?: string;

  /**
   * @param message Short, primary text shown in the snackbar header.
   * @param severity Controls alert styling and default auto-hide duration.
   * @param duration Optional override in seconds for how long the snackbar stays visible.
   * @param description Optional longer text shown in a collapsible "Details" section.
   */
  constructor(
    message: string,
    severity?: "success" | "info" | "warning" | "error",
    duration?: number,
    description?: string,
  ) {
    this.message = message;
    this.severity = severity ?? "info";
    this.duration = duration ?? this.geDefaultDuration();
    this.description = description;
  }

  getDurationMs(): number {
    return (this.duration ?? this.geDefaultDuration()) * 1000;
  }

  geDefaultDuration(): number {
    if (this.severity === "info") {
      return 1;
    } else if (this.severity === "warning" || this.severity === "error") {
      return 6;
    } else {
      return 1;
    }
  }
}

/**
 * A single entry in the rolling notification log surfaced via the user
 * menu. We snapshot the visible fields off `SnackbarUpdateImpl` (no
 * methods) so the log doesn't accidentally retain stale references to
 * the live snackbar slot.
 */
export interface LogEntry {
  /** Monotonically-increasing id — used as a React key and to dedupe. */
  id: number;
  /** Epoch milliseconds when the entry was created. */
  timestamp: number;
  message: string;
  severity: SnackbarUpdate["severity"];
  description?: string;
  /**
   * Epoch milliseconds marking the first time the user acknowledged
   * this entry (clicked it, copied it, or dismissed it). `undefined`
   * means the entry is still unread. New entries default to unread.
   */
  readAt?: number;
}

/**
 * Cap on the number of log entries we keep in memory. The user menu
 * renders a scrollable list, but older entries are dropped FIFO so the
 * store doesn't grow without bound during long sessions.
 */
const LOG_LIMIT = 200;

interface AppState {
  Message: SnackbarUpdateImpl;
  setMessage: (message: SnackbarUpdateImpl) => void;

  /**
   * Rolling log of every notification surfaced via `setMessage`. Read
   * it from the user-menu's notification panel. Order: newest first.
   */
  logs: LogEntry[];
  /** Clear the log (the user-menu "Clear all" button). */
  clearLogs: () => void;
  /** Drop a single entry (the per-row dismiss button). */
  removeLog: (id: number) => void;
  /**
   * Mark a single entry as read (no-op if it's already read or
   * absent). Idempotent so callers don't have to track state.
   */
  markAsRead: (id: number) => void;
  /**
   * Mark every entry as read in one shot. Used when the user opens
   * the notification panel — "opening = I've seen everything".
   */
  markAllAsRead: () => void;
}

const useInfoStore = create<AppState>((set) => ({
  Message: new SnackbarUpdateImpl(""),
  setMessage: (message) =>
    set((s) => ({
      Message: message,
      // Every successful `setMessage` also pushes a log entry, so the
      // notification panel never drifts out of sync with what the user
      // just saw. Empty messages are skipped — they represent the
      // initial / cleared snackbar slot rather than a real notice.
      // `readAt` is intentionally unset on insert — a brand-new
      // entry is unread until the user interacts with it.
      logs:
        message.message === ""
          ? s.logs
          : [
              {
                id: Date.now() + Math.floor(Math.random() * 1000),
                timestamp: Date.now(),
                message: message.message,
                severity: message.severity,
                description: message.description,
              },
              ...s.logs,
            ].slice(0, LOG_LIMIT),
    })),
  logs: [],
  clearLogs: () => set({ logs: [] }),
  removeLog: (id) =>
    set((s) => ({ logs: s.logs.filter((e) => e.id !== id) })),
  markAsRead: (id) =>
    set((s) => ({
      logs: s.logs.map((e) =>
        e.id === id && e.readAt === undefined
          ? { ...e, readAt: Date.now() }
          : e,
      ),
    })),
  markAllAsRead: () =>
    set((s) => {
      const now = Date.now();
      return {
        logs: s.logs.map((e) =>
          e.readAt === undefined ? { ...e, readAt: now } : e,
        ),
      };
    }),
}));

export default useInfoStore;

/**
 * Copy `text` to the system clipboard. Prefers the async Clipboard API
 * (which is the only path that works without a user gesture in many
 * embedded contexts) and falls back to a hidden `<textarea>` +
 * `execCommand` for browsers / WebViews that block it. Returns a
 * promise so callers can surface a success/failure message via the
 * info store.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
