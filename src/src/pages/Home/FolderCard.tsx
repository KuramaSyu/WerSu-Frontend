import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { getDirectoryApi } from "../../api/DirectoryApi";
import { getActivityApi } from "../../api/ActivityApi";
import type { DirectoryReply } from "../../api/models/directory";
import { FolderCardView } from "./FolderCardView";

export interface FolderCardProps {
  /** ID of the directory to render. */
  directoryId: string;
}

/**
 * Feature wrapper for a favourite directory card.
 *
 * Resolves the data needed to render a directory (`FolderCardView`) and
 * hands it resolved props - the view itself has no fetch / store / route
 * logic. Data sources:
 *
 * - directory metadata: `useDirectoryStore` cache first, then `directoryApi.get`
 * - last modification: `activityApi.getDirectoryActivityById` with limit=1
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

  // Local fetched copy used only when the store cache misses. Cache wins
  // on reads so an entry that lands in the cache after mount supersedes
  // the fetched copy.
  const [fetchedDirectory, setFetchedDirectory] = useState<
    DirectoryReply | undefined
  >(undefined);
  const [directoryFetched, setDirectoryFetched] = useState<boolean>(
    cachedDirectory !== undefined,
  );
  const [directoryMissing, setDirectoryMissing] = useState<boolean>(false);

  const directory = cachedDirectory ?? fetchedDirectory;
  const directoryLoading =
    directory === undefined && !directoryFetched && !directoryMissing;

  // Fetch directory metadata when the cache doesn't have it yet.
  useEffect(() => {
    if (
      isRoot ||
      cachedDirectory !== undefined ||
      fetchedDirectory !== undefined ||
      directoryMissing
    ) {
      return;
    }
    let isMounted = true;
    const fetchDirectory = async (): Promise<void> => {
      try {
        const api = getDirectoryApi();
        const result = await api.get(directoryId);
        if (!isMounted) {
          return;
        }
        if (result) {
          setFetchedDirectory(result);
          upsertDirectory(result);
        } else {
          setDirectoryMissing(true);
        }
      } catch (error) {
        console.error("Failed to load directory", error);
        if (isMounted) {
          setDirectoryMissing(true);
        }
      } finally {
        if (isMounted) {
          setDirectoryFetched(true);
        }
      }
    };
    void fetchDirectory();
    return () => {
      isMounted = false;
    };
  }, [
    isRoot,
    directoryId,
    cachedDirectory,
    fetchedDirectory,
    directoryMissing,
    upsertDirectory,
  ]);

  // While the activity fetch is in flight, `lastModified` stays undefined
  // and the view renders "No activity yet". Resolve it once and let the
  // view decide how to express the loading state visually.
  const [lastModified, setLastModified] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (isRoot) {
      return;
    }
    let isMounted = true;
    const fetchActivity = async (): Promise<void> => {
      try {
        const api = getActivityApi();
        const activity = await api.getDirectoryActivityById(directoryId, {
          limit: 1,
          offset: 0,
          max_depth: 1,
          directory_id: directoryId,
        });
        if (!isMounted) {
          return;
        }
        if (activity.length > 0) {
          setLastModified(activity[0].created_at);
        } else {
          setLastModified(undefined);
        }
      } catch (error) {
        console.error("Failed to load directory activity", error);
      }
    };
    void fetchActivity();
    return () => {
      isMounted = false;
    };
  }, [isRoot, directoryId]);

  const displayName = useMemo(
    () => directory?.display_name ?? directory?.name ?? "Untitled",
    [directory],
  );

  return (
    <FolderCardView
      displayName={displayName}
      onClick={() => navigate(`/d/${directoryId}`)}
      lastModified={lastModified}
      loading={directoryLoading}
      hidden={isRoot || directoryMissing || !directory}
    />
  );
};
