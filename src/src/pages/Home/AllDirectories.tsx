import { useEffect, useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { M3, M4, M5 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { FolderCard } from "./FolderCard";
import { FolderCardView, type CardSize } from "./FolderCardView";

export interface AllDirectoriesProps {
  /** Visual size preset for the rendered cards. Defaults to `small`. */
  size?: CardSize;
}

// Grid gap scales with the card size: smaller cards sit closer so a
// full row stays visually tight; larger cards get a wider gap.
const SIZE_TO_GAP: Record<CardSize, string> = {
  small: M3,
  medium: M4,
  large: M5,
};

/**
 * Lists every root-level directory the user can see, except the ones
 * already pinned as favourites in `FavouriteDirectories`.
 *
 * Fetches the full directory list (the request is shared with the rest
 * of the app via react-query) and filters to entries whose `parent_id`
 * is unset. Mirrors the result into `useDirectoryStore` so other
 * consumers (the breadcrumb, the parent selector, `FolderCard`) see the
 * metadata immediately.
 */
export const AllDirectories: React.FC<AllDirectoriesProps> = ({
  size = "small",
}) => {
  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );
  const { data: directories, isLoading } = useDirectoriesQuery(
    directoryListQuery,
    true,
  );
  const setDirectories = useDirectoryStore((s) => s.setDirectories);
  const favouriteIds = useFavouritesStore((s) => s.directories);
  const { theme } = useThemeStore();

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  // Root-level directories that are not pinned as favourites.
  const visibleDirectories = useMemo(() => {
    if (!directories) {
      return [];
    }
    return directories.filter(
      (d) =>
        (d.parent_dir_ids === undefined || d.parent_dir_ids.length === 0) &&
        !favouriteIds[d.id],
    );
  }, [directories, favouriteIds]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: SIZE_TO_GAP[size] }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <FolderCardView
            key={`skeleton-${index}`}
            displayName=""
            loading
            size={size}
          />
        ))}
      </Box>
    );
  }

  if (visibleDirectories.length === 0) {
    return (
      <Stack
        direction="row"
        spacing={M3}
        sx={{ alignItems: "center", color: theme.palette.text.secondary }}
      >
        <FolderIcon fontSize="small" />
        <Typography variant="body2">
          No other root-level directories. Create one from the Actions panel, or
          unstar a favourite to see it here.
        </Typography>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: SIZE_TO_GAP[size],
      }}
    >
      {visibleDirectories.map((d) => (
        <FolderCard key={d.id} directoryId={d.id} size={size} />
      ))}
    </Box>
  );
};
