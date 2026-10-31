import type { DirectoryReply } from "../../../api/models/directory";

type DirectoryLookup = Record<string, DirectoryReply | undefined>;

/** Label for a directory id: display_name preferred, else name, else id. */
export const directoryLabel = (id: string, directoriesById: DirectoryLookup): string => {
  const dir = directoriesById[id];
  if (!dir) return id;
  return dir.display_name || dir.name || id;
};

/**
 * Walk a directory id up to root, returning [root, ..., dir]; capped to
 * avoid pathological loops in malformed graphs.
 */
export const buildDirectoryPath = (
  startId: string,
  directoriesById: DirectoryLookup,
): string[] => {
  const chain: string[] = [];
  const seen = new Set<string>();
  let id: string | undefined = startId;
  while (id && !seen.has(id)) {
    seen.add(id);
    chain.unshift(id);
    const dir: DirectoryReply | undefined = directoriesById[id];
    if (!dir) break;
    id = dir.parent_dir_ids?.[0];
    if (chain.length > 32) break;
  }
  return chain;
};

/** Human-readable "Root / Foo / Bar" path for a directory id. */
export const directoryPathString = (
  id: string,
  directoriesById: DirectoryLookup,
): string => {
  if (id === "root" || !directoriesById[id]) return "root";
  return buildDirectoryPath(id, directoriesById)
    .map((dirId) => directoryLabel(dirId, directoriesById))
    .join(" / ");
};
