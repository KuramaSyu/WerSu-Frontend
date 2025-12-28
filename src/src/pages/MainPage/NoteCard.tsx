import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { M2, M3, M4 } from '../../statics';
import { useThemeStore } from '../../zustand/useThemeStore';
import { blendWithContrast } from '../../utils/blendWithContrast';
import type { MinimalNote } from '../../api/models/search';
import { useSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';
import { NoteEditorModal } from './Modals/NoteEditModal';
import { NoteApi, type INoteApi } from '../../api/NoteApi';
import type { string } from 'zod';

export const NoteCard: React.FC<{
  note: MinimalNote;
  index: number;
  sx?: object;
}> = ({ note, index, sx }) => {
  const { ref } = useSortable({ id: note.id, index: index });
  const { theme } = useThemeStore();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Box ref={ref}>
      <Card
        ref={ref}
        sx={{ minWidth: '4rem', ...sx }}
        variant="outlined"
        onClick={() => setModalOpen(true)}
      >
        <CardContent>
          <Typography
            variant="subtitle2"
            mb={M3}
            color={blendWithContrast(theme.palette.text.primary, theme, 1 / 4)}
          >
            {note.updated_at}
          </Typography>
          <Typography variant="h5" gutterBottom>
            {note.title}
          </Typography>
          <Typography
            variant="body2"
            color={theme.palette.text.secondary}
            sx={{ whiteSpace: 'pre-wrap' }}
          >
            {note.stripped_content.substring(0, 100)}
          </Typography>
        </CardContent>
      </Card>

      {/* modal is outside of card to keep functionality to close it on blur */}
      <NoteEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={note.title}
        content={note.stripped_content}
        onSave={(title: string, content: string) => {
          const api: INoteApi = new NoteApi();
          api
            .patch(note.id, title, content)
            .then((_) => {
              console.log(`saved note ${note.id} - ${title}`);
            })
            .catch((err) => {
              console.error(
                `failed to save note ${note.id} - ${title}: ${err}`
              );
            });
        }}
      />
    </Box>
  );
};
