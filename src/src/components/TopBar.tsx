import React, { useEffect, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Typography from '@mui/material/Typography';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import { useThemeStore } from '../zustand/useThemeStore';
import { alpha, Button } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';

import HomeIcon from '@mui/icons-material/Home';

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

  // Desktop view
  return (
    <AppBar
      position="fixed"
      color="default" // Prevent AppBar from using the theme's primary color by default
      sx={
        {
          //backgroundColor: theme.palette.background.default,
          //color: theme.palette.primary.light,
        }
      }
    >
      <Toolbar>
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {/* Title */}
          <Box>
            <Button onClick={() => navigate('/')}>Wersu</Button>
          </Box>

          {/* Home, Friends, Settings, Discord Login or Profile */}
          <Box
            sx={{
              gap: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
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
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
