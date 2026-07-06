import { Box, Stack, Typography } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { M3, M4, M5 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { FolderCard } from "./FolderCard";
import { useMemo } from "react";
import type { CardSize } from "./FolderCardView";

export interface FavouriteDirectoriesProps {
  /** Visual size preset forwarded to each `FolderCard`. */
  size?: CardSize;
}

const SIZE_TO_GAP: Record<CardSize, string> = {
  small: M3,
  medium: M4,
  large: M5,
};

/**
 * Lists every directory the user has marked as favourite.
 *
 * Reads the persisted favourite IDs from `useFavouritesStore` and renders
 * one `FolderCard` per ID. Card width is owned by `FolderCard`; this
 * component only owns the wrapping grid and the empty-state copy.
 *
 * The internal "root" id (used for the synthetic top-level hierarchy node)
 * is filtered out: it has no real metadata, so rendering it would only
 * show a loading skeleton or an empty card.
 */
export const FavouriteDirectories: React.FC<FavouriteDirectoriesProps> = ({
  size = "medium",
}) => {
  // Drop the synthetic root id; everything else is a real directory.
  const favouriteIds = useFavouritesStore((s) => s.directories);

  const filteredFavouriteIds = useMemo(() => {
    return Object.entries(favouriteIds)
      .filter(([id, isFav]) => isFav && id !== "root")
      .map(([id]) => id);
  }, [favouriteIds]);

  const { theme } = useThemeStore();
  console.log("favouriteIds", favouriteIds);

  if (filteredFavouriteIds.length === 0) {
    return (
      <Stack
        direction="row"
        spacing={M3}
        sx={{ alignItems: "center", color: theme.palette.text.secondary }}
      >
        <StarIcon fontSize="small" />
        <Typography variant="body2">
          No favourite directories yet. Star a directory from its right-panel
          actions to add it here.
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
      {filteredFavouriteIds.map((id) => (
        <FolderCard key={id} directoryId={id} size={size} />
      ))}
    </Box>
  );
};
