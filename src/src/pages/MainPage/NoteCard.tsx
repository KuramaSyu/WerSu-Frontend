import { Card, CardContent, Typography } from '@mui/material';
import { M2, M3, M4 } from '../../statics';
import { useThemeStore } from '../../zustand/useThemeStore';
import { blendWithContrast } from '../../utils/blendWithContrast';
import type { MinimalNote } from '../../api/models/search';
import { useSortable } from '@dnd-kit/react/sortable';

export const NoteCard: React.FC<{ note: MinimalNote; index: number }> = ({
  note,
  index,
}) => {
  const { ref } = useSortable({ id: note.id, index: index });
  const { theme } = useThemeStore();
  return (
    <Card sx={{ minWidth: '4rem' }} variant="outlined" ref={ref}>
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
  );
};
