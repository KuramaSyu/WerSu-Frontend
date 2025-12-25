import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import { useThemeStore } from '../zustand/useThemeStore';
import { alpha, Avatar, Button, Collapse, CssBaseline, Divider, IconButton, InputAdornment, Stack, TextField, ThemeProvider, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';

import HomeIcon from '@mui/icons-material/Home';
import { M2, M3, M4 } from '../statics';
import { LocalFireDepartment, Search } from '@mui/icons-material';
import { useUserStore } from '../zustand/userStore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';

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

enum SearchType {
  KEYWORD = 'Keyword',
  TYPO_TOLERANT = 'Typo Tolerant',
  CONTEXT = 'Context',

}
const TopBar: React.FC = () => {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const {user} = useUserStore();
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const isActive = searchText.length > 0;
  const [searchType, setSearchType] = useState<SearchType>(SearchType.KEYWORD);

  const UserDrawerContents = () => {

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Drag Handle */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 1,
            cursor: 'pointer',
          }}
          onClick={() => setUserDrawerOpen(false)}
        >
          <Box
            sx={{
              width: 40,
              height: 4,
              backgroundColor: alpha(theme.palette.text.primary, 0.3),
              borderRadius: 2,
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.5),
              },
            }}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-evenly',
                alignItems: 'center',
                p: 1,
              }}
            >
              <Avatar
                sx={{ width: 64, height: 64 }}
                src={user ? user.getAvatarUrl() : undefined}
                alt={user ? user.username : ''}
              ></Avatar>
              <Divider orientation="vertical"></Divider>
              <Typography variant="h6">
                {' '}
                {user?.username ?? 'login'}{' '}
              </Typography>
            </Box>
            <Divider></Divider>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
            <Box
              sx={{ display: 'flex', flexDirection: 'column', width: '70%' }}
            >
              <Typography variant="h6">Streak</Typography>
              <Typography variant="subtitle2">
                Amount of days where sport was back to back done
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                width: '50%',
                justifyContent: 'center',
                alignItems: 'center',
                justifyItems: 'center',
                alignContent: 'center',
              }}
            >
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  // Desktop view
  return (
    <ThemeProvider theme={theme}>
    <AppBar
      position="fixed"
      elevation={4}
      sx={
        {
          backgroundColor: theme.palette.background.paper,
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
          <Box minWidth={1/10}>
            <Button
             onClick={() => navigate('/')} 
             sx={{ fontSize: '2rem', fontWeight: 300, color: theme.palette.text.primary }}>
              Wersu
            </Button>
          </Box>
          <Box minWidth={3/10} sx={{display: 'flex', justifyContent: 'flex-end'}}>
            <Collapse in={searchText !== ""} timeout={500} orientation="horizontal">
              <Box>
            <ToggleButtonGroup
              value={searchType}
              exclusive
              onChange={(_event, newSearchType) => {
                if (newSearchType !== null) {
                  setSearchType(newSearchType);
                }
              }}
              aria-label="search type"
              sx={{
                borderRadius: M4, 
                '& .MuiToggleButton-root': {
                  whiteSpace: 'nowrap',
                }
              }}
              color='secondary'
            >
              <ToggleButton color='secondary' value={SearchType.KEYWORD} aria-label="keyword" sx={{borderTopLeftRadius: M4, borderBottomLeftRadius: M4, gap: 1}}>
                <SearchIcon /> keyword
              </ToggleButton>
              <ToggleButton value={SearchType.TYPO_TOLERANT} aria-label="typo tolerant" sx={{gap: 1}}>
                <ManageSearchIcon /> typo tolerant
              </ToggleButton>
              <ToggleButton value={SearchType.CONTEXT} aria-label="context" sx={{borderTopRightRadius: M4, borderBottomRightRadius: M4, gap: 1}}>
                <AutoAwesomeIcon /> context
              </ToggleButton>
            </ToggleButtonGroup>
              </Box>
            </Collapse>
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
                  <SearchIcon sx={{ fontSize: '1rem' }} />
                </InputAdornment>
              ),
              sx: {
                // "Properly Rounded"
                borderRadius: M4,
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
              justifyContent: 'flex-end',
              minWidth: 2/5
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
                <IconButton onClick={() => setUserDrawerOpen(true)}>
                  <Avatar
                    sx={{ width: 50, height: 50 }}
                    src={user ? user.getAvatarUrl() : undefined}
                    alt={user ? user.username : ''}
                  ></Avatar>
                </IconButton>
          </Box>
        </Stack>
      </Toolbar>
    </AppBar>
    </ThemeProvider>
  );
};

export default TopBar;
