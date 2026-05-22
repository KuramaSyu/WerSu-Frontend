import React, { useEffect, useRef, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import { useThemeStore } from "../zustand/useThemeStore";
import {
  alpha,
  Avatar,
  Button,
  Collapse,
  CssBaseline,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Slide,
  Stack,
  SwipeableDrawer,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";

import HomeIcon from "@mui/icons-material/Home";
import { M2, M3, M4 } from "../statics";
import { LocalFireDepartment, Logout, Search } from "@mui/icons-material";
import { useUserStore } from "../zustand/userStore";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { SearchNotesApi } from "../api/SearchNotesApi";
import { RestNotesSearchType } from "../api/models/search";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";
import SearchResultsOverlay from "./SearchResultsOverlay";
import SearchStrategySelect from "./SearchStrategySelect";

const Pages = {
  HOME: "/",
  FRIENDS: "/friends",
  SETTINGS: "/settings",
  HISTORY: "/history",
  SETTINGSV2: "/settings-v2",
} as const;

type Page = (typeof Pages)[keyof typeof Pages];

function containedIfSelected(page: Page) {
  const location = useLocation();
  return location.pathname === page ? "contained" : "outlined";
}

enum SearchType {
  KEYWORD = "Keyword",
  TYPO_TOLERANT = "Typo Tolerant",
  CONTEXT = "Context",
  LATEST = "Latest",
}

export interface TopBarProps {
  scrollContainer?: HTMLElement | null;
}

export const TopBar: React.FC<TopBarProps> = ({ scrollContainer }) => {
  const [showBar, setShowBar] = useState(true);
  const lastYRef = useRef(0);

  const { theme, themeName, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUserStore();
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchType, setSearchType] = useState<RestNotesSearchType>(
    RestNotesSearchType.CONTEXT,
  );
  const { isMobile } = useBreakpoint();
  const { isModalOpen, setIsModalOpen, isSearching, setIsSearching } =
    useSearchNotesStore();

  // initial search
  useEffect(() => {
    const SEARCH_LIMIT = 50;
    async function search() {
      const api = new SearchNotesApi();
      await api.search(RestNotesSearchType.LATEST, searchText, SEARCH_LIMIT, 0);
    }
    search();
  }, []);

  // debounce search input so typing stays responsive
  useEffect(() => {
    if (!searchActive) {
      setDebouncedSearchText(searchText);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchText, searchActive]);

  // perform search
  useEffect(() => {
    const SEARCH_LIMIT = 50;
    async function search() {
      setIsSearching(true);
      const api = new SearchNotesApi();
      if (searchText === "") {
        await api.search(
          RestNotesSearchType.LATEST,
          searchText,
          SEARCH_LIMIT,
          0,
        );
      } else {
        await api.search(searchType, debouncedSearchText, SEARCH_LIMIT, 0);
      }
      setIsSearching(false);
    }
    if (searchActive) {
      search();
    }
  }, [debouncedSearchText, searchType, searchActive, setIsSearching]);

  // watchdog to hide/show top bar depending on scroll direction
  useEffect(() => {
    const TRIGGER_HIDE_DELTA = 4; // ignore tiny scrolls
    const target = scrollContainer ?? window;
    const getY = () =>
      scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    lastYRef.current = getY();

    const onScroll = () => {
      const y = getY();
      const lastY = lastYRef.current;

      const delta = y - lastY;
      if (Math.abs(delta) < TRIGGER_HIDE_DELTA) {
        return;
      }

      if (delta > 0 && y > 24) {
        // scrolling down -> hide
        setShowBar(false);
      } else if (delta < 0) {
        // scrolling up -> show
        setShowBar(true);
      }

      lastYRef.current = y;
    };

    // trigger always when scrolling
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [scrollContainer]);

  const UserDrawerContents = () => {
    const dragHandle = (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 1,
          cursor: "pointer",
        }}
        onClick={() => setUserDrawerOpen(false)}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            backgroundColor: alpha(theme.palette.text.primary, 0.3),
            borderRadius: 2,
            transition: "background-color 0.2s ease",
            "&:hover": {
              backgroundColor: alpha(theme.palette.text.primary, 0.5),
            },
          }}
        />
      </Box>
    );

    const handleLogout = () => {
      setUser(null);
      setUserDrawerOpen(false);
    };

    return (
      <Box sx={{ width: 280 }}>
        {isMobile && dragHandle}

        {/* User Profile Section */}
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Avatar
            sx={{ width: 80, height: 80, mx: "auto", mb: 2 }}
            src={user?.getAvatarUrl()}
            alt={user?.username ?? ""}
          />
          <Typography variant="h6">{user?.username ?? "Guest"}</Typography>
        </Box>

        <Divider />

        {/* Streak Section */}
        <List>
          <ListItem>
            <ListItemIcon>
              <LocalFireDepartment color="error" />
            </ListItemIcon>
            <ListItemText
              primary="Streak"
              secondary="Days of consecutive activity"
            />
          </ListItem>
        </List>

        <Divider />

        {/* Logout Button */}
        <List>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </List>
      </Box>
    );
  };

  // Desktop view
  return (
    <>
      <Slide appear={false} direction="down" in={showBar}>
        <div>
          <AppBar
            position="fixed"
            elevation={4}
            sx={{
              backgroundColor: theme.palette.background.paper,
              mt: M3,
              borderRadius: "2rem",

              left: "1rem",
              right: "1rem",
              width: "auto",
            }}
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
                <Box minWidth={1 / 10}>
                  <Button
                    onClick={() => navigate("/")}
                    sx={{
                      fontSize: "2rem",
                      fontWeight: 300,
                      color: theme.palette.text.primary,
                    }}
                  >
                    Wersu
                  </Button>
                </Box>
                <Box
                  minWidth={3 / 10}
                  sx={{ display: "flex", justifyContent: "center" }}
                >
                  <Collapse
                    in={searchText !== "" || searchActive}
                    timeout={300}
                    orientation="horizontal"
                  >
                    <Box>
                      <SearchStrategySelect
                        searchType={searchType}
                        setSearchType={setSearchType}
                      />
                    </Box>
                  </Collapse>
                </Box>
                <Box sx={{ zIndex: 1000 }}>
                  <TextField
                    fullWidth
                    placeholder="Search"
                    variant="outlined"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      if (e.target.value && searchActive) {
                        setIsModalOpen(true);
                      }
                    }}
                    onFocus={() => {
                      setSearchActive(true);
                      if (searchText) {
                        setIsModalOpen(true);
                      }
                    }}
                    onBlur={() => setSearchActive(false)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ fontSize: "1rem" }} />
                          </InputAdornment>
                        ),
                        sx: {
                          // "Properly Rounded"
                          borderRadius: M4,
                          // Adjust internal padding for height
                          "& .MuiOutlinedInput-input": {
                            padding: "calc(1em / 1.6) 0.5rem",
                          },
                        },
                      },
                    }}
                  />
                </Box>
                {/* Home, Friends, Settings, Discord Login or Profile */}
                <Box
                  sx={{
                    gap: 1,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    minWidth: 2 / 5,
                  }}
                >
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select
                      value={themeName}
                      onChange={(event) => void setTheme(event.target.value)}
                      displayEmpty
                      sx={{
                        borderRadius: M4,
                        "& .MuiSelect-select": {
                          py: "0.35rem",
                        },
                      }}
                      inputProps={{ "aria-label": "Select theme" }}
                    >
                      <MenuItem value="default">Nord Dark</MenuItem>
                      <MenuItem value="docsTheme">Nord Bright</MenuItem>
                      <MenuItem value="github">GitHub Light</MenuItem>
                      <MenuItem value="github-dark">GitHub Dark</MenuItem>
                      <MenuItem value="bright">Bright Theme</MenuItem>
                      <MenuItem value="midnight">Midnight Blue</MenuItem>
                    </Select>
                  </FormControl>
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
                      alt={user ? user.username : ""}
                    ></Avatar>
                  </IconButton>
                </Box>
              </Stack>
            </Toolbar>
            <SwipeableDrawer
              anchor="right"
              onOpen={() => setUserDrawerOpen(true)}
              open={userDrawerOpen}
              onClose={() => setUserDrawerOpen(false)}
            >
              <UserDrawerContents />
            </SwipeableDrawer>
          </AppBar>
        </div>
      </Slide>
      <SearchResultsOverlay
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isLoading={isSearching}
        searchQuery={debouncedSearchText}
        searchType={searchType}
      />
    </>
  );
};
