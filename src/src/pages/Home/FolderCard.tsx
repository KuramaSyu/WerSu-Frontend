import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { getActivityApi } from "../../api/ActivityApi";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { useIsAuthenticated } from "../../api/queries/useUser";
import { UserError } from "../../api/models/UserError";
import { FolderCardView, type CardSize } from "./FolderCardView";
import type { NoteVersionSummaryReply } from "../../api/models/activity";

export interface FolderCardProps {
  // ID of the directory to render.
  directoryId: string;
  // Visual size preset forwarded to FolderCardView.
  size?: CardSize;
}

const activityApi = getActivityApi();

// Feature wrapper for a favourite directory card. Reads from the shared directory list query, falls back to useDirectory.
export const FolderCard: React.FC<FolderCardProps> = ({
  directoryId,
  size = "medium",
}) => {
  const navigate = useNavigate();
  const { byId: directoriesById } = useAllDirectoriesQuery();
  // Gate per-card activity fetch on auth so N cards do not fan out N 401s on the cold-start frame.
  const isAuthed = useIsAuthenticated();
  const cachedDirectory = directoriesById[directoryId];

  const isRoot = directoryId === "root";

  // Skip the fetch when we already have a cached record from the shared list query.
  const {
    data: fetchedDirectory,
    isPending: isDirectoryPending,
    error,
  } = useDirectory(cachedDirectory || isRoot ? undefined : directoryId);

  // On a 403, drop this directory from favourites and surface a one-shot info snackbar.
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

  // Favourite state. toggleDirectory is the source of truth so an external setDirectoryFavourite still wins.
  const isFavourite = useFavouritesStore((s) =>
    directoryId ? Boolean(s.directories[directoryId]) : false,
  );
  const toggleDirectory = useFavouritesStore((s) => s.toggleDirectory);

  // Latest activity timestamp (single row). Inlined useQuery because this is the only consumer right now.
  const { data: activity } = useQuery<NoteVersionSummaryReply[]>({
    queryKey: ["activity", "directory", directoryId],
    queryFn: () =>
      activityApi.getDirectoryActivityById(directoryId, {
        limit: 1,
        offset: 0,
        max_depth: 1,
        directory_id: directoryId,
      }),
    // See the auth-gate comment above for the cold-start rationale.
    enabled: !isRoot && isAuthed,
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
      isFavourite={isFavourite}
      // stopPropagation keeps the click from also firing the card's own onClick and navigating into the directory.
      onToggleFavourite={(event) => {
        event.stopPropagation();
        toggleDirectory(directoryId);
      }}
    />
  );
};
