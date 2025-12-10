import { Box, ButtonBase, InputAdornment, Paper, Stack, TextField } from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import { AnimatePresence, motion } from 'framer-motion';


import { Logo } from '../../components/logo';
import TopBar from '../../components/TopBar';
import { useEffect, useRef, useState } from 'react';
import CreateIcon from '@mui/icons-material/Create';

export const MainPage: React.FC = () => {
  const { theme } = useThemeStore();
  const [searchText, setSearchText] = useState('');
  const hasText = searchText.length > 0;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        alignSelf: 'center',
        fontFamily: "Open Sans",
      }}
    >
      <TopBar></TopBar>
      <Box sx={{pt: '8rem', height: 'calc(100% - 8rem)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <CreateNote></CreateNote>
      </Box>
    </div>
  );
};


export const CreateNote: React.FC = () => {
  const { theme } = useThemeStore();
  const [noteText, setNoteText] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Autofocus content when expanded
  // useEffect(() => {
  //   if (open && contentRef.current) {
  //     contentRef.current.focus();
  //   }
  // }, [open]);

  return <Stack width={1/3} spacing={'1rem'} sx={{backgroundColor: theme.palette.background.paper, padding: '1rem', borderRadius: '1rem'}}>
    
      <AnimatePresence mode='wait' initial={false}>
     {!open && (

        <TextField
        variant="outlined"
        defaultValue={'New Note'}
          onClick={() => setOpen(true)}
          slotProps={
            {
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CreateIcon sx={{ fontSize: '1.5rem', color: theme.palette.primary.light }} />
                  </InputAdornment>
                )
              }
            }}
        > 
        </TextField>
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
            }
          }}
          sx={{
            p: 2,
            borderRadius: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <TextField
            placeholder="Title"
            variant="standard"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          />
        </Paper>
        </motion.div>
      )}
      </AnimatePresence>
  </Stack>;
}
