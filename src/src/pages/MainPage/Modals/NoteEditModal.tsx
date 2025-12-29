import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  type Theme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '../../../zustand/useThemeStore';
import { M1, M2, M3, M4 } from '../../../statics';

interface NoteEditorModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onSave: (title: string, content: string) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  open,
  onClose,
  title,
  content,
  onSave,
}) => {
  const { theme } = useThemeStore();

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
      }}
      maxWidth="md"
      sx={{ color: theme.palette.text.primary }}
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.palette.background.paper,
          padding: M3,
        }}
      >
        {title}
        <IconButton
          onClick={() => {
            onClose();
          }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          backgroundColor: theme.palette.background.default,
          minHeight: '40vh',
          // display: 'flex',
        }}
      ></DialogContent>
    </Dialog>
  );
};
