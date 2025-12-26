import { Box, Grid } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSearchNotesStore } from '../../zustand/useSearchNotesStore';
import { NoteCard } from './NoteCard';
import { M1, M2, M3, M4, M5, M6 } from '../../statics';
import { useLoadingStore } from '../../zustand/loadingStore';

export const CardGrid: React.FC = () => {
  const { notes, setNotes } = useSearchNotesStore();
  const { isLoading } = useLoadingStore();

  const cards = useMemo(() => {
    return notes.map((note, index) => (
      <NoteCard key={note.id} note={note} index={index}></NoteCard>
    ));
  }, [notes]);

  if (isLoading) {
    return <></>;
  }
  return (
    <Box
      sx={{
        columnCount: { xs: 1, sm: 2, md: 3, lg: 4 },
        gap: M2,
        width: '100%',
      }}
    >
      {cards.map((c) => (
        <Box key={c.key} sx={{ breakInside: 'avoid', mb: M2 }}>
          {c}
        </Box>
      ))}
    </Box>
  );
};
