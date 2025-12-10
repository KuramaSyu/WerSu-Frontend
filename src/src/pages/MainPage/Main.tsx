import { Box, InputAdornment, Stack, TextField } from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import { AnimatePresence, motion } from 'framer-motion';


import { Logo } from '../../components/logo';
import TopBar from '../../components/TopBar';
import { useState } from 'react';
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
      <Box sx={{pt: '4rem', height: 'calc(100% - 4rem)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <CreateNote></CreateNote>
      </Box>
    </div>
  );
};


export const CreateNote: React.FC = () => {
  return <Box>
    <TextField
      variant="outlined"
      placeholder="Create a new note..."
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <CreateIcon />
            </InputAdornment>
          ),
        },
      }}
    />
  </Box>;
}
