import { Box, ButtonBase, Grid, InputAdornment, Paper, Stack, TextField, ThemeProvider } from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import { AnimatePresence, motion } from 'framer-motion';


import { Logo } from '../../components/logo';
import TopBar from '../../components/TopBar';
import { useEffect, useMemo, useRef, useState } from 'react';
import CreateIcon from '@mui/icons-material/Create';
import { TestSearchNotesApi, type SearchNotesApi } from '../../api/SearchNotesApi';
import { useNotesStore } from '../../zustand/useNotesStore';
import { NoteCard } from './NoteCard';
import { M2, M3, M4, M5, M6 } from '../../statics';
import { useUserStore } from '../../zustand/userStore';
import { useLoadingStore } from '../../zustand/loadingStore';
import { LoadingPage } from '../LoadingPage/Main';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { LoginPage } from '../LoginPage/Main';

export const MainPage: React.FC = () => {
  const { theme } = useThemeStore();
  const [searchText, setSearchText] = useState('');
  const { notes, setNotes } = useNotesStore();
  const {user} = useUserStore();
  const {isLoading} = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100)
  );
  const oneOrZero = Math.round(exitPercentage / 100) * 100;
 

  // fetch notes
  useEffect(() => {
    async function fetchNotes() {
      const api_service: SearchNotesApi = new TestSearchNotesApi();
      const notes = await api_service.search('', 'all', 50, 0);
      console.log(notes);
      setNotes(notes);
    }
    fetchNotes();
  }, [])

  const cards = useMemo(() => {
    return notes.map((note) => (
      <NoteCard key={note.id} note={note} ></NoteCard>
    ))
  }, [notes])

  const MainContent = () => (
      <Box
      sx={{
        height: '100%',
        width: '100%',
        alignSelf: 'center',
        fontFamily: "Open Sans",
        display: 'flex',
        overflow: 'auto'
      }}
    >
      <TopBar></TopBar>
      {/* add padding of the actual margin, topbar, and margin of top bar */}
      <Box sx={{pt: `calc(${M4} + ${M5} + ${M3})`, height: 'calc(100% - 8rem)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <CreateNote></CreateNote>
        <Grid container spacing={M3} p={M4} width={'100%'} size={{ xs: 2, sm: 4, md: 4 }}>
          {cards.map((c) => (<Grid key={c.key}>{c}</Grid>))}
        </Grid>
      
      </Box>
    </Box>
  );

    return (
    <ThemeProvider theme={theme}>
      {/* Loading Animation for Loading Page
      which is as long visible as "overlay" as
      it needs to fetch all resources via REST. */}
      <AnimatePresence initial={false}>
        {isLoading && (
          <motion.div
            initial={false}
            animate={{ clipPath: 'circle(100% at 50% 50%)' }}
            exit={{
              clipPath: oneOrZero
                ? `circle(0% at 100% ${exitPercentage}%)`
                : `circle(0% at ${exitPercentage}% 100%)`,
              opacity: 0.2,
            }}
            transition={{
              duration: 1,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              position: 'fixed',
              zIndex: 9999,
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
            }}
          >
            <LoadingPage></LoadingPage>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Box for either the Main App or Login Page, depending on user state */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          overflow: 'hidden', // Prevents overflow
          paddingTop: user !== null && !isMobile ? '6px' : undefined,
        }}
      >
        {user !== null || isLoading ? (
          <>
            <MainContent></MainContent>
          </>
        ) : (
          <>
            {console.log('render login page')}
            <LoginPage></LoginPage>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};


export const CreateNote: React.FC = () => {
  const { theme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');


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
