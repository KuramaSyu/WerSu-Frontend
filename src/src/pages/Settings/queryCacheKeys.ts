import type { QueryClient } from "@tanstack/react-query";

/**
 * Settings `Cache` row: bundled query-key roots the user can wipe together.
 */
export interface QueryCacheGroup {
  /** Stable id, used by the UI to look up the group for the snackbar copy. */
  id: string;
  /** Human-readable label rendered next to the wipe button. */
  label: string;
  /** One-line description of what the cache holds. */
  description: string;
  /** Top-level query-key segments covered by this group. */
  roots: readonly string[];
}

/** Cache groups the Settings page exposes. `accessToken` is excluded: wiping it signs the user out. */
export const queryCacheGroups: readonly QueryCacheGroup[] = [
  {
    id: "notes",
    label: "Notes",
    description: "Latest notes list, search results, and per-note detail.",
    roots: ["notes", "versions"],
  },
  {
    id: "directories",
    label: "Directories",
    description: "Directory list, single-directory detail, and notes inside.",
    roots: ["directories", "directory"],
  },
  {
    id: "history",
    label: "History & activity",
    description:
      "Activity feed, most-used notes, and per-note version history.",
    roots: ["history", "activity"],
  },
  {
    id: "attachments",
    label: "Attachments",
    description: "Per-note attachment metadata.",
    roots: ["attachments"],
  },
  {
    id: "shares",
    label: "Shares",
    description: "Share management list and per-share detail.",
    roots: ["shares"],
  },
  {
    id: "publicShares",
    label: "Public shares",
    description: "Public-share grants and cached access tokens.",
    roots: ["publicShares"],
  },
  {
    id: "users",
    label: "Users",
    description:
      "Current user, user lookups, and bootstrap-loaded latest notes.",
    roots: ["user", "users", "user-load", "search-notes-latest"],
  },
];

/** Sentinel for `wipeQueryGroups(client, [WIPE_ALL_SENTINEL])`: wipe every group in one shot. */
export const WIPE_ALL_SENTINEL = "__all__";

/** Sentinel for `wipeQueryGroups(client, [WIPE_ALL_EXCEPT_USERS_SENTINEL])`: wipe every group except `users`. */
export const WIPE_ALL_EXCEPT_USERS_SENTINEL = "__all_except_users__";

/** First-key predicate that matches any of the supplied root prefixes. */
export const matchesRoots = (
  queryKey: readonly unknown[],
  roots: ReadonlySet<string>,
): boolean => {
  const first = queryKey[0];
  return typeof first === "string" && roots.has(first);
};

/** Union of roots for the given group ids. Sentinels: `WIPE_ALL_SENTINEL` = every group, `WIPE_ALL_EXCEPT_USERS_SENTINEL` = every group except `users`. `null` if nothing matched. */
function collectRoots(groupIds: readonly string[]): ReadonlySet<string> | null {
  const roots = new Set<string>();
  const excludeUser = groupIds.includes(WIPE_ALL_EXCEPT_USERS_SENTINEL);
  for (const id of groupIds) {
    if (id === WIPE_ALL_SENTINEL || id === WIPE_ALL_EXCEPT_USERS_SENTINEL) {
      for (const group of queryCacheGroups) {
        if (excludeUser && group.id === "users") {
          continue;
        }
        for (const root of group.roots) {
          roots.add(root);
        }
      }
      continue;
    }
    const group = queryCacheGroups.find((g) => g.id === id);
    if (!group) {
      continue;
    }
    for (const root of group.roots) {
      roots.add(root);
    }
  }
  return roots.size === 0 ? null : roots;
}

/**
 * Drop every cache entry whose first key segment is in the union of `groupIds`'s roots,
 * returning how many were removed. `removeQueries` returns `void` in v5, so `findAll` is used for the count.
 */
export function wipeQueryGroups(
  client: QueryClient,
  groupIds: readonly string[],
): number {
  const roots = collectRoots(groupIds);
  if (roots === null) {
    return 0;
  }
  const rootsSet: ReadonlySet<string> = roots;
  const predicate = (queryKey: readonly unknown[]) =>
    matchesRoots(queryKey, rootsSet);
  const matched = client
    .getQueryCache()
    .findAll({ predicate: (q) => predicate(q.queryKey) });
  if (matched.length === 0) {
    return 0;
  }
  client.removeQueries({ predicate: (q) => predicate(q.queryKey) });
  return matched.length;
}
