import { Box, InputAdornment, Stack, TextField } from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import { AnimatePresence, motion } from 'framer-motion';


import { Logo } from '../../components/logo';
import TopBar from '../../components/TopBar';
import { useState } from 'react';

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
      }}
    >
      <TopBar></TopBar>
      <Box
        component={motion.div}
        animate={{
          height: hasText ? '15%' : '33%',
          width: hasText ? '66vw' : '100vw',
          position: 'absolute',
          zIndex: hasText ? 1000 : 1,
        }}
        transition={{
          duration: 0.5,
          ease: 'easeInOut',
        }}
        sx={{
          minWidth: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          justifyItems: 'center',
          display: 'flex',
        }}
      >
      </Box>
    </div>
  );
};
