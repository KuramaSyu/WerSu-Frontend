import { Box, InputAdornment, Stack, TextField } from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import SearchIcon from '@mui/icons-material/Search';
import { AnimatePresence, motion } from 'framer-motion';


import { Logo } from '../../components/logo';
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
      <Box
        component={motion.div}
        animate={{
          height: hasText ? '15%' : '33%',
          width: hasText ? '66vw' : '100vw',
          position: 'absolute',
          //top: hasText ? 0 : 'auto',
          //left: hasText ? '50%' : 'auto',
          //x: hasText ? '-50%' : 0,
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
        <Stack
          component="div"
          direction="row"
          spacing={8}
          alignItems="center"
          width="100%"
          height="100%"
          sx={{ backgroundColor: theme.palette.background.paper, padding: 16 }}
        >

            <AnimatePresence>
              {!hasText && 
              <Box 
              component={motion.div} 
              initial={{ opacity: 1 }} 
              exit={{opacity: 0}} 
              transition={{ duration: 0.3 }} sx={{ height: '33vh'}}>
                <Logo
                //style={{ width: '100%', height: '100%' }}
                monochrome={false}
              />
              </Box>
              }

            </AnimatePresence>
          <TextField
            fullWidth
            placeholder="Search for anything..."
            variant="outlined"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            slotProps={{input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '2.5rem' }} />
                </InputAdornment>
              ),
              sx: {
                // "BIG"
                fontSize: '2rem',
                // "Properly Rounded"
                borderRadius: '50px',
                // Adjust internal padding for height
                '& .MuiOutlinedInput-input': {
                  padding: '18px 0',
                },
              },
            }}}
          />
        </Stack>
      </Box>
    </div>
  );
};
