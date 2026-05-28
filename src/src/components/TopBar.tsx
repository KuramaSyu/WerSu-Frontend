import React, { useEffect, useRef, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import { useThemeStore } from "../zustand/useThemeStore";
import {
  alpha,
  Avatar,
  Button,
  Divider,
  FormControl,
  IconButton,
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
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import HomeIcon from "@mui/icons-material/Home";
import { M2, M3, M4 } from "../statics";
import { LocalFireDepartment, Logout, Search } from "@mui/icons-material";
import { useUserStore } from "../zustand/userStore";
import { useBreakpoint } from "../hooks/useBreakpoint";
import SearchBar from "./search/SearchBar";

const Pages = {
  HOME: "/",
  FRIENDS: "/friends",
  SETTINGS: "/settings",
  HISTORY: "/history",
  SETTINGSV2: "/settings-v2",
  GRAPH: "/graph",
} as const;

type Page = (typeof Pages)[keyof typeof Pages];

function containedIfSelected(page: Page) {
  const location = useLocation();
  return location.pathname === page ? "contained" : "outlined";
}

export interface TopBarProps {
  scrollContainer?: HTMLElement | null;
}

const TopBar: React.FC<TopBarProps> = ({ scrollContainer }) => {
  const [showBar, setShowBar] = useState(true);
  const lastYRef = useRef(0);

  const { theme, themeName, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUserStore();
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const { isMobile } = useBreakpoint();

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
                <SearchBar />
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
                <Button
                  variant={containedIfSelected(Pages.GRAPH)}
                  onClick={() => navigate(Pages.GRAPH)}
                  color="inherit"
                >
                  <AccountTreeIcon />
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
      </Slide>
    </>
  );
};

export default TopBar;
