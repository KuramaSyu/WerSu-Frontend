/**
 * Wire types for the note visibility API.
 *
 * Visibility is a per-user set of rules that hides a note or a whole
 * directory from one or more recommendation surfaces. The scope is a
 * bitmask so a single rule can hide a target from several surfaces at
 * once.
 *
 * The REST backend is intentionally not implemented yet. All call sites
 * talk to `NoteVisibilityApi`, so a future direct backend integration can
 * replace `RestNoteVisibilityApi` without touching UI code.
 */

/** Recommendation surfaces a visibility rule can apply to. Values are flags. */
export enum NoteVisibilityScope {
  /** Last used / recent notes lists. */
  RECENT_NOTES = 1 << 0,
  /** Frequently used notes lists. */
  FREQUENT_NOTES = 1 << 1,
  /** Global note search results. */
  SEARCH = 1 << 2,
}

/** Every scope that exists today, combined into one mask. */
export const NOTE_VISIBILITY_SCOPE_ALL =
  NoteVisibilityScope.RECENT_NOTES |
  NoteVisibilityScope.FREQUENT_NOTES |
  NoteVisibilityScope.SEARCH;

/** Every individual scope, in display order. */
export const NOTE_VISIBILITY_SCOPES: readonly NoteVisibilityScope[] = [
  NoteVisibilityScope.RECENT_NOTES,
  NoteVisibilityScope.FREQUENT_NOTES,
  NoteVisibilityScope.SEARCH,
];

/** Human label for one scope flag. */
export const noteVisibilityScopeLabel = (
  scope: NoteVisibilityScope,
): string => {
  switch (scope) {
    case NoteVisibilityScope.RECENT_NOTES:
      return "Recent notes";
    case NoteVisibilityScope.FREQUENT_NOTES:
      return "Frequently used";
    case NoteVisibilityScope.SEARCH:
      return "Search";
    default:
      return "Unknown";
  }
};

/** True when a rule's scope mask covers the requested scope. */
export const scopeIncludes = (
  ruleScope: number,
  scope: NoteVisibilityScope,
): boolean => (ruleScope & scope) !== 0;

/** Split a mask into its individual scopes, in display order. */
export const scopesFromMask = (
  mask: number,
): NoteVisibilityScope[] =>
  NOTE_VISIBILITY_SCOPES.filter((scope) => scopeIncludes(mask, scope));

/** Target a visibility rule applies to. */
export type NoteVisibilityTargetKind = "note" | "directory";

/** A note or directory that can be hidden. */
export interface NoteVisibilityTarget {
  kind: NoteVisibilityTargetKind;
  id: string;
}

/** One stored visibility rule as returned by the backend. */
export interface NoteVisibilityEntry {
  kind: NoteVisibilityTargetKind;
  /** Note id or directory id, depending on `kind`. */
  id: string;
  /** Bitmask of `NoteVisibilityScope` values. */
  scope: number;
  /** RFC3339 timestamp of when the rule was created. */
  hidden_at: string;
  /** RFC3339 timestamp when the rule expires. Omitted means permanent. */
  expires_at?: string;
}

/** Optional expiry when creating a rule. */
export interface HideVisibilityOptions {
  /** Hide for this many days from now. Ignored when `until` is set. */
  days?: number;
  /** Absolute expiry. */
  until?: Date | string;
}

/** Body accepted by `POST /api/visibility`. */
export interface HideVisibilityRequest {
  note_id?: string;
  directory_id?: string;
  /** Bitmask of `NoteVisibilityScope` values. */
  scope: number;
  /** ISO timestamp. Omit for a permanent rule. */
  expires_at?: string;
}

/** Body accepted by `DELETE /api/visibility`. Omit all target fields to clear everything. */
export interface UnhideVisibilityRequest {
  note_id?: string;
  directory_id?: string;
  /** Only remove these scopes. Omit to remove the whole rule. */
  scope?: number;
  /** Explicitly clear every rule. */
  all?: boolean;
}

/** Reply from `DELETE /api/visibility`. */
export interface UnhideVisibilityReply {
  /** True when at least one rule was removed. */
  success: boolean;
}

/**
 * Stable interface every visibility implementation must satisfy.
 *
 * The store and UI only depend on this type; swapping the REST client for
 * an in-process backend bridge is therefore a one-line registry change.
 */
export interface NoteVisibilityApi {
  /** Read every rule for the current user. */
  list(): Promise<NoteVisibilityEntry[]>;

  /** Create or extend a rule for a note. */
  hideNote(
    noteId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry>;

  /** Create or extend a rule for a directory. */
  hideDirectory(
    directoryId: string,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry>;

  /** Create or extend a rule for either target kind. */
  hide(
    target: NoteVisibilityTarget,
    scope: number,
    options?: HideVisibilityOptions,
  ): Promise<NoteVisibilityEntry>;

  /** Remove a rule, or only some of its scopes. Omit the request to clear everything. */
  unhide(request?: UnhideVisibilityRequest): Promise<boolean>;
}

/**
 * Resolve the expiry timestamp for a hidden target.
 * Returns `undefined` for a permanent rule.
 */
export function resolveVisibilityExpiry(
  options?: HideVisibilityOptions,
): string | undefined {
  if (!options) {
    return undefined;
  }
  if (options.until !== undefined) {
    const date =
      options.until instanceof Date ? options.until : new Date(options.until);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid visibility expiry date");
    }
    return date.toISOString();
  }
  if (options.days !== undefined && options.days > 0) {
    return new Date(Date.now() + options.days * 86_400_000).toISOString();
  }
  return undefined;
}

/** True when a rule exists and has not expired. */
export function isVisibilityRuleActive(
  entry: { expires_at?: string },
  now: number = Date.now(),
): boolean {
  if (!entry.expires_at) {
    return true;
  }
  const expiry = new Date(entry.expires_at).getTime();
  return !Number.isFinite(expiry) || expiry > now;
}