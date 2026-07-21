import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { getActivityApi } from "../../api/ActivityApi";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { UserError } from "../../api/models/UserError";
import { FolderCardView, type CardSize } from "./FolderCardView";
import type { NoteVersionSummaryReply } from "../../api/models/activity";

export interface FolderCardProps {
  /** ID of the directory to render. */
  directoryId: string;
  /** Visual size preset forwarded to `FolderCardView`. */
  size?: CardSize;
}

const activityApi = getActivityApi();

/**
 * Feature wrapper for a favourite directory card.
 * which fetches it using `useDirectory` if it's not in cache (`useDirectoryStore`).
 */
export const FolderCard: React.FC<FolderCardProps> = ({
  directoryId,
  size = "medium",
}) => {
  const navigate = useNavigate();
  const cachedDirectory = useDirectoryStore(
    (s) => s.directoriesById[directoryId],
  );
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory);

  const isRoot = directoryId === "root";

  // Skip the fetch when we already have a cached record - the store is
  // kept fresh by `useDirectoriesQuery` on DirectoryView / MainContent.
  const {
    data: fetchedDirectory,
    isPending: isDirectoryPending,
    error,
  } = useDirectory(cachedDirectory || isRoot ? undefined : directoryId);

  // Mirror fetched records back into the store so other consumers (the
  // breadcrumb, the parent selector, etc.) see the metadata immediately.
  useEffect(() => {
    if (fetchedDirectory) {
      upsertDirectory(fetchedDirectory);
    }
  }, [fetchedDirectory, upsertDirectory]);

  // On a 403, drop this directory from favourites and surface a one-shot
  // info snackbar. The ref guards against re-running the side effect when
  // the query re-renders with the same error (e.g. on tab focus).
  const handledForbiddenRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !error ||
      !(error instanceof UserError) ||
      error.status !== 403 ||
      isRoot ||
      handledForbiddenRef.current === directoryId
    ) {
      return;
    }
    handledForbiddenRef.current = directoryId;
    useFavouritesStore.getState().setDirectoryFavourite(directoryId, false);
    useInfoStore
      .getState()
      .setMessage(
        new SnackbarUpdateImpl(
          "Favourite directory removed: access denied",
          "info",
        ),
      );
  }, [error, directoryId, isRoot]);

  const directory = cachedDirectory ?? fetchedDirectory ?? null;
  const isForbidden = error instanceof UserError && error.status === 403;
  const isMissing = !isDirectoryPending && (!directory || isForbidden);
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

  return (
    <FolderCardView
      displayName={displayName}
      onClick={() => navigate(`/d/${directoryId}`)}
      imageUrl={directory?.image_url}
      lastModified={lastModified}
      loading={isLoading}
      hidden={isRoot || isMissing}
      size={size}
    />
  );
};
