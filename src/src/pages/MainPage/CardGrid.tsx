import { Box, Grid, useMediaQuery } from '@mui/material';
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { useSearchNotesStore } from '../../zustand/useSearchNotesStore';
import { NoteCard } from './NoteCard';
import { M1, M2, M3, M4, M5, M6 } from '../../statics';
import { useLoadingStore } from '../../zustand/loadingStore';
import { useThemeStore } from '../../zustand/useThemeStore';

export const CardGrid: React.FC = () => {
  const { notes, setNotes } = useSearchNotesStore();
  const { isLoading } = useLoadingStore();

  const { theme } = useThemeStore();
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));

  const columnCount = isXs ? 1 : isSm ? 2 : isMd ? 3 : 4;

  // Sort notes for display in row-major order (left-to-right, top-to-bottom)
  const displayNotes = useMemo(() => {
    // craete x empty columns
    const columns: (typeof notes)[] = Array.from(
      { length: columnCount },
      () => []
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

  if (isLoading) {
    return <></>;
  }

  return (
    <Box
      sx={{
        columnCount: { xs: 1, sm: 2, md: 3, lg: 4 },
        columnGap: M2,
      }}
    >
      {displayNotes.map((note) => {
        const originalIndex = notes.findIndex((n) => n.id === note.id);
        return (
          <NoteCard
            key={note.id}
            note={note}
            index={originalIndex}
            sx={{ mb: M2, breakInside: 'avoid' }}
          />
        );
      })}
    </Box>
  );
};
