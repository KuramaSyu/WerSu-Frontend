import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { getActivityApi } from "../../api/ActivityApi";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { FolderCardView } from "./FolderCardView";
import type { NoteVersionSummaryReply } from "../../api/models/activity";

export interface FolderCardProps {
  /** ID of the directory to render. */
  directoryId: string;
}

const activityApi = getActivityApi();

/**
 * Feature wrapper for a favourite directory card.
 *
 * Resolves the data needed to render a directory (`FolderCardView`) and
 * hands it resolved props - the view itself has no fetch / store / route
 * logic. Data sources:
 *
 * - directory metadata: `useDirectoryStore` cache first, then the
 *   `useDirectory` TanStack hook (cache miss path).
 * - last modification: an inline `useQuery` against the directory
 *   activity endpoint.
 */
export const FolderCard: React.FC<FolderCardProps> = ({ directoryId }) => {
  const navigate = useNavigate();
  const cachedDirectory = useDirectoryStore(
    (s) => s.directoriesById[directoryId],
  );
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory);

  // The synthetic top-level hierarchy node carries the literal id "root";
  // it has no real metadata and must never be rendered as a folder card.
  const isRoot = directoryId === "root";

  // Skip the fetch when we already have a cached record - the store is
  // kept fresh by `useDirectoriesQuery` on DirectoryView / MainContent.
  const { data: fetchedDirectory, isPending: isDirectoryPending } =
    useDirectory(cachedDirectory || isRoot ? undefined : directoryId);

  // Mirror fetched records back into the store so other consumers (the
  // breadcrumb, the parent selector, etc.) see the metadata immediately.
  useEffect(() => {
    if (fetchedDirectory) {
      upsertDirectory(fetchedDirectory);
    }
  }, [fetchedDirectory, upsertDirectory]);

  const directory = cachedDirectory ?? fetchedDirectory ?? null;
  const isMissing = !isDirectoryPending && !directory;
  const isLoading = !!directoryId && isDirectoryPending && !cachedDirectory;

  // Latest activity timestamp (single row). Inlined `useQuery` because
  // this is the only consumer right now - if a second consumer appears,
  // lift into `useDirectoryActivityQuery` next to `useDirectory`.
  const { data: activity } = useQuery<NoteVersionSummaryReply[]>({
    queryKey: ["activity", "directory", directoryId],
    queryFn: () =>
      activityApi.getDirectoryActivityById(directoryId, {
        limit: 1,
        offset: 0,
        max_depth: 1,
        directory_id: directoryId,
      }),
    enabled: !isRoot,
  });
  const lastModified =
    activity && activity.length > 0 ? activity[0].created_at : undefined;

  const displayName = useMemo(
    () => directory?.display_name ?? directory?.name ?? "Untitled",
    [directory],
  );

  console.log("directory:", directory);

  return (
    <FolderCardView
      displayName={displayName}
      onClick={() => navigate(`/d/${directoryId}`)}
      imageUrl={directory?.image_url}
      lastModified={lastModified}
      loading={isLoading}
      hidden={isRoot || isMissing}
    />
  );
};
