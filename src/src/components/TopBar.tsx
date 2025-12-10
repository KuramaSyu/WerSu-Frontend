import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import { useThemeStore } from '../zustand/useThemeStore';
import { Button, CssBaseline, InputAdornment, Stack, TextField, ThemeProvider, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';

import HomeIcon from '@mui/icons-material/Home';
import { M2, M3 } from '../statics';

export const Pages = {
  HOME: '/',
  FRIENDS: '/friends',
  SETTINGS: '/settings',
  HISTORY: '/history',
  SETTINGSV2: '/settings-v2',
} as const;

type Page = (typeof Pages)[keyof typeof Pages];

function containedIfSelected(page: Page) {
  const location = useLocation();
  return location.pathname === page ? 'contained' : 'outlined';
}

const TopBar: React.FC = () => {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const isActive = searchText.length > 0;

  // Desktop view
  return (
    <ThemeProvider theme={theme}>
    <AppBar
      position="fixed"
      color="default" // Prevent AppBar from using the theme's primary color by default
      sx={
        {
          mt: M3,
          borderRadius: '2rem',
          width: 'calc(100% - 2rem)',
          left: '50%',
          transform: 'translateX(-50%)',
        }
      }
    >
      <Toolbar>
        <Stack
          flexGrow={1}
          direction="row"
          spacing={2} 
          alignItems="center"
          justifyContent="space-between"
          fontFamily="Open Sans"
        >
          {/* Title */}
          <Box minWidth={1/4}>
            <Button
             onClick={() => navigate('/')} 
             sx={{ fontSize: '2rem', fontWeight: 300, color: theme.palette.text.primary }}>
              Wersu
            </Button>
          </Box>
          <Box>
          <TextField
            fullWidth
            placeholder="Search"
            variant="outlined"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            slotProps={{input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1.5rem' }} />
                </InputAdornment>
              ),
              sx: {
                // "BIG"
                fontSize: '1.5rem',
                // "Properly Rounded"
                borderRadius: '2rem',
                // Adjust internal padding for height
                '& .MuiOutlinedInput-input': {
                  padding: '0.5rem 0.5rem',
                },
              },
            }}}
          />
          </Box>
          {/* Home, Friends, Settings, Discord Login or Profile */}
          <Box
            sx={{
              gap: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              minWidth: 1/4
            }}
          >
            <Button
              variant={containedIfSelected(Pages.HOME)}
              onClick={() => navigate(Pages.HOME)}
              color="inherit"
            >
              <HomeIcon />
            </Button>
            <Button
              variant={containedIfSelected(Pages.FRIENDS)}
              onClick={() => navigate(Pages.FRIENDS)}
              color="inherit"
            >
              <PeopleIcon />
            </Button>
            <Button
              variant={containedIfSelected(Pages.SETTINGSV2)}
              onClick={() => navigate(Pages.SETTINGSV2)}
              color="inherit"
            >
              <SettingsIcon />
            </Button>
          </Box>
        </Stack>
      </Toolbar>
    </AppBar>
    </ThemeProvider>
  );
};

export default TopBar;
