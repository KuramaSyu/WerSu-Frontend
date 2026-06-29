import React from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Slide,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { LeftPanelToggle, RightPanelToggle } from "../LeftPanelToggle";
import SearchBar from "../search/SearchBar";
import { M1, M2, M3, M4 } from "../../statics";
import { useContainedIfSelected, Pages } from "./Pages";
import { useLayout } from "../../LayoutProvider";

export interface TopBarAppBarProps {
  /**
   * Toggled when the user taps their avatar. Owned by the parent
   * `TopBar` so the SwipeableDrawer can stay next to the state it
   * drives.
   */
  onOpenUserDrawer: () => void;
}

/**
 * The `AppBar` + `Toolbar` body of the top bar. Pure presentational
 * apart from navigation hooks; the parent `TopBar` owns open/close
 * state for the user drawer so this component stays trivially
 * testable.
 */
export const TopBarAppBar: React.FC<TopBarAppBarProps> = ({
  onOpenUserDrawer,
}) => {
  const { theme, themeName, setTheme, customThemes } = useThemeStore();
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { showTopBar } = useLayout();
  // Resolve the per-route variants once per render so the JSX
  // stays clean and so the hook lint rule sees the hook call in
  // a stable position at the top of the component body.
  const homeVariant = useContainedIfSelected(Pages.HOME);
  const graphVariant = useContainedIfSelected(Pages.GRAPH);

  // The scroll-driven show / hide animation needs `<Slide>` to wrap
  // the `position: fixed` `AppBar` directly. Wrapping the `AppBar`
  // with a static `<Box>` (the previous structure) makes the slide
  // target un-anchorable and silently kills the animation; the
  // AppBar's own `position: fixed` is what gives `<Slide direction="down">`
  // a stable origin to translate against.
  return (
    <Slide
      appear={false}
      direction="down"
      in={showTopBar}
      timeout={theme.transitions.duration.standard}
      easing={{
        enter: theme.transitions.easing.easeInOut,
        exit: theme.transitions.easing.easeInOut,
      }}
    >
      <AppBar
        position="fixed"
        elevation={4}
        sx={{
          mt: M3,
          borderRadius: "2rem",
          left: "1rem",
          right: "1rem",
          width: "auto",
        }}
      >
      <Toolbar>
        <Stack
          direction="row"
          spacing={M2}
          sx={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Side panel toggle */}
          <LeftPanelToggle />

          {/* Title */}
          <Box sx={{ minWidth: 1 / 10 }}>
            <Button
              onClick={() => navigate("/")}
              sx={{
                fontSize: theme.typography.h4.fontSize,
                fontWeight: 300,
                fontFamily: '"Fira Sans", sans-serif',
              }}
            >
              <Typography
                sx={{
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  fontWeight: "inherit",
                  color: theme.palette.primary.light,
                }}
              >
                Wer
              </Typography>
              <Typography
                sx={{
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  fontWeight: "inherit",
                  color: theme.palette.secondary.light,
                }}
              >
                Su
              </Typography>
            </Button>
          </Box>

          {/* Centered search */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              minWidth: 3 / 10,
            }}
          >
            <SearchBar />
          </Box>

          {/* Right cluster: theme + nav + avatar */}
          <Box
            sx={{
              gap: M1,
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
                onChange={(event) => setTheme(event.target.value)}
                displayEmpty
                sx={{
                  borderRadius: M4,
                  "& .MuiSelect-select": {
                    py: "0.35rem",
                  },
                }}
                inputProps={{ "aria-label": "Select theme" }}
              >
                {customThemes.map((theme) => (
                  <MenuItem
                    key={theme.custom.themeName}
                    value={theme.custom.themeName}
                  >
                    {theme.custom.longName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant={homeVariant}
              onClick={() => navigate(Pages.HOME)}
              color="inherit"
            >
              <HomeIcon />
            </Button>
            <Button
              variant={graphVariant}
              onClick={() => navigate(Pages.GRAPH)}
              color="inherit"
            >
              <AccountTreeIcon />
            </Button>
            <Button onClick={onOpenUserDrawer} color="inherit">
              <UserAvatarButton user={user} />
            </Button>
            <RightPanelToggle />
          </Box>
        </Stack>
      </Toolbar>
    </AppBar>
    </Slide>
  );
};

/**
 * Tiny helper so the AppBar stays focused on layout. The button
 * itself is plain — it just wraps the avatar — and the parent owns
 * the click handler via `onOpenUserDrawer`.
 */
const UserAvatarButton: React.FC<{
  user: ReturnType<typeof useUser>["data"];
}> = ({ user }) => (
  <Avatar
    sx={{ width: 50, height: 50 }}
    src={user ? user.getAvatarUrl() : undefined}
    alt={user ? user.username : ""}
  />
);

export default TopBarAppBar;
