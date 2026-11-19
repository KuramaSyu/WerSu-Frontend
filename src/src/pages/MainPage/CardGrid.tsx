import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { NoteCard } from "./NoteCard";
import { M2, M4 } from "../../statics";
import { useLoadingStore } from "../../zustand/loadingStore";
import type { MinimalNote } from "../../api/models/search";

export interface CardGridProps {
  title: string;
  notes: Array<MinimalNote>;
  loading?: boolean;
  /** When provided, cards call this instead of opening the popup modal. */
  onNoteOpen?: (note: MinimalNote) => void;
  /**
   * Render only the grid content, without the surrounding Paper and
   * section title. Used when an outer page surface already provides the
   * background and hierarchy.
   */
  bare?: boolean;
}

export const CardGrid: React.FC<CardGridProps> = ({
  title,
  notes,
  loading = false,
  onNoteOpen,
  bare = false,
}) => {
  const { isLoading } = useLoadingStore();
  const { isSearching } = useSearchNotesStore();

  const columnCount = useColumnCount(22, 12);

  // Sort notes for display in row-major order (left-to-right, top-to-bottom)
  const displayNotes = useMemo(() => {
    // craete x empty columns
    const columns: (typeof notes)[] = Array.from(
      { length: columnCount },
      () => [],
    );

    // distribute notes into columns.
    // here the top-to-bottom, left-to-right order is
    // converted to left-to-right, top-to-bottom order
    notes.forEach((note, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex].push(note);
    });

    // flatten columns back into a single array, that DND does not break
    return columns.flat();
  }, [notes, columnCount]);

  if (loading || isLoading || isSearching) {
    const placeholderCount = Math.max(4, columnCount * 2);
    const loadingNotes = Array.from(
      { length: placeholderCount },
      (_, index) => ({
        id: `loading-note-${index}`,
        title: "Loading note",
        author_id: "loading",
        updated_at: new Date().toISOString(),
        stripped_content: "Loading content",
        directory_ids: [],
        tag_ids: [],
      }),
    );

    const loadingGrid = (
      <Box
        sx={{
          columnCount: columnCount,
          columnGap: M2,
        }}
      >
        {loadingNotes.map((note) => (
          <Box
            key={note.id}
            sx={{
              mb: M2,
              breakInside: "avoid",
              display: "inline-block",
              width: "100%",
            }}
          >
            <NoteCard note={note} loading sx={{ width: "100%" }} />
          </Box>
        ))}
      </Box>
    );

    if (bare) {
      return loadingGrid;
    }

    return (
      <Paper sx={{ p: M4 }} elevation={1}>
        <Skeleton
          variant="text"
          width="100%"
          animation="wave"
          sx={{ mb: M4 }}
        />
        {loadingGrid}
      </Paper>
    );
  }

  const grid = (
    <Box
      sx={{
        columnCount: columnCount,
        columnGap: M2,
        width: "100%",
      }}
    >
      {displayNotes.map((note) => {
        return (
          <NoteCard
            key={note.id}
            note={note}
            onOpen={onNoteOpen}
            sx={{
              mb: M2,
            }}
          />
        );
      })}
    </Box>
  );

  if (bare) {
    return grid;
  }

  return (
    <Paper sx={{ p: M4 }} elevation={1}>
      <Typography variant="h2" sx={{ mb: M4 }}>
        {title}
      </Typography>
      {grid}
    </Paper>
  );
};

/**
 * A custom hook that calculates the number of columns that can fit in the available
 * width of the window based on the specified card width in rem and maximum columns.
 *
 * @param cardWidth - The width of each card in rem. Default 20rem
 * @param maxColumns - The maximum number of columns allowed. Defaults to 10.
 * @returns The calculated number of columns that can fit in the current window width.
 *
 * @example
 * const columnCount = useColumnCount(20, 10);
 */
function useColumnCount(cardWidth = 20, maxColumns = 10): number {
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const update = () => {
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      setColumnCount(
        Math.min(
          maxColumns,
          Math.max(1, Math.floor(window.innerWidth / (cardWidth * rem))),
        ),
      );
    };

    update();

    window.addEventListener("resize", update);
  }, [cardWidth, maxColumns]);

  return columnCount;
}
