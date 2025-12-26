import { Grid } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSearchNotesStore } from '../../zustand/useSearchNotesStore';
import { NoteCard } from './NoteCard';
import { M1, M2, M3, M4, M5, M6 } from '../../statics';
import { useLoadingStore } from '../../zustand/loadingStore';

export const CardGrid: React.FC = () => {
  const { notes, setNotes } = useSearchNotesStore();
  const { isLoading } = useLoadingStore();

  const cards = useMemo(() => {
    return notes.map((note) => <NoteCard key={note.id} note={note}></NoteCard>);
  }, [notes]);

  if (isLoading) {
    return <></>;
  }
  return (
    <Grid
      container
      spacing={M3}
      p={M4}
      width={'100%'}
      size={{ xs: 2, sm: 4, md: 4 }}
    >
      {cards.map((c) => (
        <Grid key={c.key}>{c}</Grid>
      ))}
    </Grid>
  );
};
