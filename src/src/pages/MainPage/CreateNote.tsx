import {
  Box,
  ButtonBase,
  Grid,
  InputAdornment,
  Paper,
  Slide,
  Snackbar,
  Stack,
  TextField,
  ThemeProvider,
} from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import { AnimatePresence, motion } from 'framer-motion';

import { useState } from 'react';
import CreateIcon from '@mui/icons-material/Create';

import { note_of_date_at_hour } from '../../utils/NoteTitleTemplates';
import { NoteApi } from '../../api/NoteApi';
import { useNotesStore } from '../../zustand/useNotesStore';

export const CreateNote: React.FC = () => {
  const { theme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(note_of_date_at_hour());
  const [content, setContent] = useState('');
  const { updateNote } = useNotesStore();
  const [snackbarState, setSnackbarState] = useState({
    open: false,
  });

  // saves note to backend and updates store
  async function save_note() {
    const api = new NoteApi();
    const note = await api.post(title, content);
    if (note !== undefined) {
      setSnackbarState({ open: true });
      updateNote(note);
    }
  }
  return (
    <Stack
      width={1 / 3}
      spacing={'1rem'}
      sx={{
        backgroundColor: theme.palette.background.paper,
        padding: '1rem',
        borderRadius: '1rem',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!open && (
          <TextField
            variant="outlined"
            defaultValue={'New Note'}
            onClick={() => setOpen(true)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CreateIcon
                      sx={{
                        fontSize: '1.5rem',
                        color: theme.palette.primary.light,
                      }}
                    />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: theme.palette.primary.main,
                  borderWidth: 2,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.primary.light,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.light,
                },
              },
            }}
          ></TextField>
        )}

        {open && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Paper
              elevation={3}
              // tab index and onBlur to close when clicking outside
              tabIndex={-1}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setOpen(false);
                  save_note();
                }
              }}
              sx={{
                p: 2,
                borderRadius: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <TextField
                placeholder={title}
                variant="standard"
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                color="primary"
              />

              <TextField
                autoFocus
                placeholder="Take a note..."
                variant="outlined"
                minRows={3}
                multiline
                fullWidth
                value={content}
                onChange={(e) => setContent(e.target.value)}
                color="secondary"
              />
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
      <Snackbar
        open={snackbarState.open}
        onClose={() => setSnackbarState({ open: false })}
        slots={{ transition: Slide }}
        message="Uploaded Note"
        key={Slide.name}
        autoHideDuration={1200}
      />
    </Stack>
  );
};
