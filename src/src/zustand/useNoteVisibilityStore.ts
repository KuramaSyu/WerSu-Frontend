/**
 * Per-user note visibility rules.
 *
 * The store is the single read model every list uses to drop hidden notes
 * and directories. It persists to localStorage so hidden rows stay hidden
 * across reloads, and mirrors changes to `NoteVisibilityApi` on a
 * best-effort basis: the backend endpoint is not live yet, so a failed
 * request must not make the UI forget what the user just hid.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getNoteVisibilityApi } from "../api/NoteVisibilityApi";
import {
  NOTE_VISIBILITY_SCOPE_ALL,
  noteVisibilityScopeLabel,
  scopeIncludes,
  scopesFromMask,
  type HideVisibilityOptions,
  type NoteVisibilityEntry,
  type NoteVisibilityScope,
  type NoteVisibilityTarget,
} from "../api/models/noteVisibility";

const STORAGE_KEY = "note-visibility-storage";
const STORAGE_VERSION = 1;

/** Local representation of one active rule. */
export interface VisibilityRule {
  /** Bitmask of `NoteVisibilityScope` values. */
  scope: number;
  /** Milliseconds since epoch. */
  hiddenAt: number;
  /** Milliseconds since epoch. Omitted for a permanent rule. */
  expiresAt?: number;
}

export type VisibilityRuleMap = Record<string, VisibilityRule>;

export interface NoteVisibilityState {
  /** Rules keyed by note id. */
  notes: VisibilityRuleMap;
  /** Rules keyed by directory id. */
  directories: VisibilityRuleMap;
  /** True after the first successful or failed backend sync attempt. */
  loaded: boolean;

  hideNote: (
    noteId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ) => void;
  hideDirectory: (
    directoryId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ) => void;
  hideTarget: (
    target: NoteVisibilityTarget,
    scope: number,
    options?: HideVisibilityOptions,
  ) => void;
  unhideNote: (noteId: string, scope?: number) => void;
  unhideDirectory: (directoryId: string, scope?: number) => void;
  unhideTarget: (target: NoteVisibilityTarget, scope?: number) => void;
  /** Drop every rule. */
  clear: () => void;
  /** Replace local rules with the backend list. */
  replaceEntries: (entries: NoteVisibilityEntry[]) => void;
  /** Pull the current rules from the backend. Never throws. */
  refresh: () => Promise<void>;
  /** Remove locally expired rules. */
  purgeExpired: () => void;
}

const emptyRules = (): VisibilityRuleMap => ({});

export const mergeVisibilityRule = (
  record: VisibilityRuleMap,
  id: string,
  scope: number,
  expiresAt?: number,
): VisibilityRuleMap => {
  const now = Date.now();
  const existing = record[id];
  if (!existing) {
    return {
      ...record,
      [id]: {
        scope: scope & NOTE_VISIBILITY_SCOPE_ALL,
        hiddenAt: now,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      },
    };
  }

  // Extend the existing rule rather than replacing it: hiding a note in
  // another surface must not undo the first hide.
  const combinedScope = (existing.scope | scope) & NOTE_VISIBILITY_SCOPE_ALL;
  const permanent =
    existing.expiresAt === undefined || expiresAt === undefined;
  const nextExpiry = permanent
    ? undefined
    : Math.max(existing.expiresAt ?? 0, expiresAt);

  return {
    ...record,
    [id]: {
      scope: combinedScope,
      hiddenAt: existing.hiddenAt,
      ...(nextExpiry !== undefined ? { expiresAt: nextExpiry } : {}),
    },
  };
};

export const removeVisibilityRule = (
  record: VisibilityRuleMap,
  id: string,
  scope?: number,
): VisibilityRuleMap => {
  const existing = record[id];
  if (!existing) {
    return record;
  }
  if (scope === undefined || (existing.scope & ~scope) === 0) {
    const next = { ...record };
    delete next[id];
    return next;
  }
  return {
    ...record,
    [id]: { ...existing, scope: existing.scope & ~scope },
  };
};

/** Convert an ISO timestamp into ms; invalid/missing becomes undefined. */
const parseExpiry = (value?: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Apply one backend entry to the local maps. */
const upsertEntry = (
  notes: VisibilityRuleMap,
  directories: VisibilityRuleMap,
  entry: NoteVisibilityEntry,
): { notes: VisibilityRuleMap; directories: VisibilityRuleMap } => {
  const hiddenAt = new Date(entry.hidden_at).getTime();
  const rule: VisibilityRule = {
    scope: entry.scope,
    hiddenAt: Number.isFinite(hiddenAt) ? hiddenAt : Date.now(),
    ...(entry.expires_at ? { expiresAt: parseExpiry(entry.expires_at) } : {}),
  };
  return entry.kind === "note"
    ? { notes: { ...notes, [entry.id]: rule }, directories }
    : { notes, directories: { ...directories, [entry.id]: rule } };
};

/** Best-effort mirror of a local hide to the backend. */
const syncHide = (
  target: NoteVisibilityTarget,
  scope: number,
  expiresAt?: number,
): void => {
  try {
    void getNoteVisibilityApi()
      .hide(target, scope, {
        ...(expiresAt !== undefined
          ? { until: new Date(expiresAt) }
          : {}),
      })
      .catch((error: unknown) => {
        console.warn("NoteVisibilityApi.hide failed", error);
      });
  } catch (error) {
    console.warn("NoteVisibilityApi is unavailable", error);
  }
};

/** Best-effort mirror of a local unhide to the backend. */
const syncUnhide = (target: NoteVisibilityTarget, scope?: number): void => {
  try {
    void getNoteVisibilityApi()
      .unhide({
        ...(target.kind === "note"
          ? { note_id: target.id }
          : { directory_id: target.id }),
        ...(scope !== undefined ? { scope } : {}),
      })
      .catch((error: unknown) => {
        console.warn("NoteVisibilityApi.unhide failed", error);
      });
  } catch (error) {
    console.warn("NoteVisibilityApi is unavailable", error);
  }
};

/** Best-effort mirror of a full clear to the backend. */
const syncClear = (): void => {
  try {
    void getNoteVisibilityApi()
      .unhide({ all: true })
      .catch((error: unknown) => {
        console.warn("NoteVisibilityApi.unhide(all) failed", error);
      });
  } catch (error) {
    console.warn("NoteVisibilityApi is unavailable", error);
  }
};

export const useNoteVisibilityStore = create<NoteVisibilityState>()(
  persist(
    (set, get) => ({
      notes: emptyRules(),
      directories: emptyRules(),
      loaded: false,

      hideNote: (noteId, scope, options) =>
        get().hideTarget({ kind: "note", id: noteId }, scope, options),
      hideDirectory: (directoryId, scope, options) =>
        get().hideTarget({ kind: "directory", id: directoryId }, scope, options),

      hideTarget: (target, scope, options) => {
        if (scope <= 0) {
          return;
        }
        const expiresAt = options
          ? resolveVisibilityExpiryLocal(options)
          : undefined;
        set((state) =>
          target.kind === "note"
            ? { notes: mergeVisibilityRule(state.notes, target.id, scope, expiresAt) }
            : {
                directories: mergeVisibilityRule(
                  state.directories,
                  target.id,
                  scope,
                  expiresAt,
                ),
              },
        );
        syncHide(target, scope, expiresAt);
      },

      unhideNote: (noteId, scope) =>
        get().unhideTarget({ kind: "note", id: noteId }, scope),
      unhideDirectory: (directoryId, scope) =>
        get().unhideTarget({ kind: "directory", id: directoryId }, scope),

      unhideTarget: (target, scope) => {
        set((state) =>
          target.kind === "note"
            ? { notes: removeVisibilityRule(state.notes, target.id, scope) }
            : { directories: removeVisibilityRule(state.directories, target.id, scope) },
        );
        syncUnhide(target, scope);
      },

      clear: () => {
        set({ notes: emptyRules(), directories: emptyRules() });
        syncClear();
      },

      replaceEntries: (entries) => {
        const next = {
          notes: emptyRules(),
          directories: emptyRules(),
        };
        for (const entry of entries) {
          const applied = upsertEntry(next.notes, next.directories, entry);
          next.notes = applied.notes;
          next.directories = applied.directories;
        }
        set({ ...next, loaded: true });
        get().purgeExpired();
      },

      refresh: async () => {
        try {
          const entries = await getNoteVisibilityApi().list();
          get().replaceEntries(entries);
        } catch (error) {
          console.warn("NoteVisibilityApi.list failed", error);
          set({ loaded: true });
        }
      },

      purgeExpired: () => {
        const now = Date.now();
        set((state) => ({
          notes: purgeMap(state.notes, now),
          directories: purgeMap(state.directories, now),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notes: state.notes,
        directories: state.directories,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<NoteVisibilityState>;
        return {
          ...current,
          notes: isRuleMap(p.notes) ? p.notes : current.notes,
          directories: isRuleMap(p.directories)
            ? p.directories
            : current.directories,
        };
      },
    },
  ),
);

/** Local expiry resolver mirroring `resolveVisibilityExpiry`. */
export function resolveVisibilityExpiryLocal(
  options: HideVisibilityOptions,
): number | undefined {
  if (options.until !== undefined) {
    const date =
      options.until instanceof Date ? options.until : new Date(options.until);
    return Number.isNaN(date.getTime()) ? undefined : date.getTime();
  }
  if (options.days !== undefined && options.days > 0) {
    return Date.now() + options.days * 86_400_000;
  }
  return undefined;
}

function isRuleMap(value: unknown): value is VisibilityRuleMap {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function purgeMap(record: VisibilityRuleMap, now: number): VisibilityRuleMap {
  let changed = false;
  const next: VisibilityRuleMap = {};
  for (const [id, rule] of Object.entries(record)) {
    if (rule.expiresAt === undefined || rule.expiresAt > now) {
      next[id] = rule;
    } else {
      changed = true;
    }
  }
  return changed ? next : record;
}

/** True when a local rule has not expired yet. */
function localRuleActive(rule: VisibilityRule, now: number): boolean {
  return rule.expiresAt === undefined || rule.expiresAt > now;
}

/** True when a rule map hides an id for the requested scope. */
export function ruleHiddenForScope(
  record: VisibilityRuleMap,
  id: string,
  scope: NoteVisibilityScope,
  now: number = Date.now(),
): boolean {
  const rule = record[id];
  if (!rule) {
    return false;
  }
  return scopeIncludes(rule.scope, scope) && localRuleActive(rule, now);
}

/**
 * True when a note is hidden directly, or through any of its directories.
 * Pure helper so list components can subscribe to the raw maps.
 */
export function isNoteHiddenForScope(
  notes: VisibilityRuleMap,
  directories: VisibilityRuleMap,
  noteId: string,
  scope: NoteVisibilityScope,
  directoryIds: readonly string[] = [],
  now: number = Date.now(),
): boolean {
  if (ruleHiddenForScope(notes, noteId, scope, now)) {
    return true;
  }
  return directoryIds.some((id) =>
    ruleHiddenForScope(directories, id, scope, now),
  );
}

/** Convert the store's local rule into the backend wire shape. */
export function ruleToEntry(
  target: NoteVisibilityTarget,
  rule: VisibilityRule,
): NoteVisibilityEntry {
  return {
    kind: target.kind,
    id: target.id,
    scope: rule.scope,
    hidden_at: new Date(rule.hiddenAt).toISOString(),
    ...(rule.expiresAt !== undefined
      ? { expires_at: new Date(rule.expiresAt).toISOString() }
      : {}),
  };
}

/** Flatten the local maps into entries, skipping expired rules. */
export function listVisibilityEntries(
  notes: VisibilityRuleMap,
  directories: VisibilityRuleMap,
  now: number = Date.now(),
): NoteVisibilityEntry[] {
  const entries: NoteVisibilityEntry[] = [];
  for (const [id, rule] of Object.entries(notes)) {
    if (localRuleActive(rule, now)) {
      entries.push(ruleToEntry({ kind: "note", id }, rule));
    }
  }
  for (const [id, rule] of Object.entries(directories)) {
    if (localRuleActive(rule, now)) {
      entries.push(ruleToEntry({ kind: "directory", id }, rule));
    }
  }
  return entries;
}

/** Scope labels for a rule mask, used by the settings page. */
export function visibilityScopeLabels(scope: number): string[] {
  return scopesFromMask(scope).map((entry) =>
    noteVisibilityScopeLabel(entry),
  );
}