import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local, persisted tracker for notes that have unsaved local edits
 * (a.k.a. drafts).
 *
 * This is intentionally ONLY the client-side half. Cross-device sync is
 * planned: when the API lands, `useDraftStates` (see
 * `api/queries/useDraftQueries.ts`) will fetch the server state and
 * hydrate this store through `setDrafts`. The rest of the app keeps
 * talking to `useDraftStates` / this store, so no call site changes.
 *
 * We deliberately store only metadata and not the live editor content:
 * draft bodies can be large and change on every keystroke, and the
 * Y.Doc / server snapshot already owns the content. The tracker needs
 * to answer "does this note have unsaved work", "how much changed", and
 * "how long has it been unsaved" -- which is enough to rank urgency.
 */

const STORAGE_KEY = "draft-tracker-storage";
const STORAGE_VERSION = 2;

export interface DraftEntry {
  /** Note this draft belongs to. */
  noteId: string;
  /** Epoch ms of the last local edit. Drives recency ordering. */
  updatedAt: number;
  /** Epoch ms of the first edit in the current unsaved session. */
  firstEditAt: number;
  /**
   * Cumulative magnitude of unsaved edits (insert/delete units summed
   * over transactions). This is an urgency proxy, NOT an exact diff:
   * undo/redo and re-typing count again on top. Cheap to maintain and
   * good enough to rank "what is most at risk of being lost".
   */
  changedChars: number;
}

export interface MarkDraftOptions {
  /** Magnitude of this edit, added to the running total. Clamped at >= 0. */
  changedChars?: number;
  /** Override the timestamp (tests / deterministic callers). */
  updatedAt?: number;
}

export interface DraftTrackerState {
  /** noteId -> draft entry. O(1) membership for rendering. */
  drafts: Record<string, DraftEntry>;

  /** Record/refresh a note's draft, accumulating change magnitude. */
  markDraft: (noteId: string, options?: MarkDraftOptions) => void;

  /** Clear a note's draft (e.g. after a successful save / discard). */
  clearDraft: (noteId: string) => void;

  /**
   * Bulk replace. Reserved for cross-device sync: an API query can
   * hydrate the tracker with server draft states through this setter.
   * Kept separate from `markDraft` so a server payload cannot be
   * confused with an incremental local edit.
   */
  setDrafts: (entries: readonly DraftEntry[]) => void;

  /** Drop every tracked draft. */
  clearAll: () => void;
}

export const useDraftStore = create<DraftTrackerState>()(
  persist(
    (set) => ({
      drafts: {},

      markDraft: (noteId, options = {}) => {
        const { changedChars = 0, updatedAt = Date.now() } = options;
        const delta = Math.max(0, changedChars);
        set((state) => {
          const existing = state.drafts[noteId];
          const next: DraftEntry = existing
            ? {
                ...existing,
                updatedAt,
                changedChars: existing.changedChars + delta,
              }
            : {
                noteId,
                updatedAt,
                firstEditAt: updatedAt,
                changedChars: delta,
              };
          return { drafts: { ...state.drafts, [noteId]: next } };
        });
      },

      clearDraft: (noteId) =>
        set((state) => {
          if (!(noteId in state.drafts)) {
            return state;
          }
          const next = { ...state.drafts };
          delete next[noteId];
          return { drafts: next };
        }),

      setDrafts: (entries) =>
        set(() => ({
          drafts: entries.reduce<Record<string, DraftEntry>>((acc, entry) => {
            acc[entry.noteId] = entry;
            return acc;
          }, {}),
        })),

      clearAll: () => set({ drafts: {} }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // Only the map is persisted; the actions are recreated on load.
      partialize: (state) => ({ drafts: state.drafts }),
      // v1 stored only { noteId, updatedAt }. Backfill the new fields so
      // an existing local draft does not disappear on upgrade.
      migrate: (persisted) => {
        const state = persisted as
          | { drafts?: Record<string, Partial<DraftEntry>> }
          | undefined;
        if (!state?.drafts) {
          return { drafts: {} } as DraftTrackerState;
        }
        const drafts: Record<string, DraftEntry> = {};
        for (const [id, entry] of Object.entries(state.drafts)) {
          drafts[id] = {
            noteId: entry.noteId ?? id,
            updatedAt: entry.updatedAt ?? Date.now(),
            firstEditAt: entry.firstEditAt ?? entry.updatedAt ?? Date.now(),
            changedChars: entry.changedChars ?? 0,
          };
        }
        return { drafts } as DraftTrackerState;
      },
    },
  ),
);

/** Milliseconds since the current unsaved session started. */
export const getDraftAgeMs = (
  entry: DraftEntry,
  now: number = Date.now(),
): number => Math.max(0, now - entry.firstEditAt);

/**
 * Higher = more urgent to save. Change volume dominates; age escalates
 * it slowly so a small-but-stale draft still climbs over time.
 */
export const getDraftUrgencyScore = (
  entry: DraftEntry,
  now: number = Date.now(),
): number => {
  // Cap the age contribution at one day so a very old, tiny draft
  // cannot outrank a large recent one purely on staleness.
  const ageMinutes = Math.min(getDraftAgeMs(entry, now) / 60_000, 24 * 60);
  return entry.changedChars * (1 + ageMinutes / 10);
};

export type DraftUrgency = "low" | "medium" | "high";

/** Coarse urgency bucket for the Home badge colour. */
export const getDraftUrgency = (
  entry: DraftEntry,
  now: number = Date.now(),
): DraftUrgency => {
  const score = getDraftUrgencyScore(entry, now);
  if (score >= 5000) return "high";
  if (score >= 1000) return "medium";
  return "low";
};

/** Human label for the tracked change magnitude. */
export const formatDraftChangeLabel = (changedChars: number): string => {
  if (changedChars >= 1000) {
    return `~${(changedChars / 1000).toFixed(1)}k chars changed`;
  }
  return `~${changedChars} char${changedChars === 1 ? "" : "s"} changed`;
};

/** Compact chip label for the tracked change magnitude (e.g. "~1.5k"). */
export const formatDraftSizeChip = (changedChars: number): string => {
  if (changedChars >= 1000) {
    return `~${(changedChars / 1000).toFixed(1)}k`;
  }
  return `~${changedChars}`;
};
