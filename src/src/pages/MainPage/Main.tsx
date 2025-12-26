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

import { Logo } from '../../components/logo';
import TopBar from '../../components/TopBar';
import { useEffect, useMemo, useRef, useState } from 'react';
import CreateIcon from '@mui/icons-material/Create';
import {
  SearchNotesApi,
  TestSearchNotesApi,
  type ISearchNotesApi,
} from '../../api/SearchNotesApi';
import { useSearchNotesStore } from '../../zustand/useSearchNotesStore';
import { NoteCard } from './NoteCard';
import { M1, M2, M3, M4, M5, M6 } from '../../statics';
import { useUserStore } from '../../zustand/userStore';
import { useLoadingStore } from '../../zustand/loadingStore';
import { LoadingPage } from '../LoadingPage/Main';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { LoginPage } from '../LoginPage/Main';
import { RestNotesSearchType } from '../../api/models/search';
import { note_of_date_at_hour } from '../../utils/NoteTitleTemplates';
import { NoteApi } from '../../api/NoteApi';
import { useNotesStore } from '../../zustand/useNotesStore';
import { CardGrid } from './CardGrid';
import { MainContent } from './MainContent';

export const MainPage: React.FC = () => {
  const { theme } = useThemeStore();
  const { user } = useUserStore();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100)
  );
  const oneOrZero = Math.round(exitPercentage / 100) * 100;

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
          paddingTop: user !== null && !isMobile ? M1 : undefined,
        }}
      >
        {user !== null || isLoading ? (
          <MainContent></MainContent>
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
