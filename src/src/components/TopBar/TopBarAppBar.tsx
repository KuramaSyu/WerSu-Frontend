import React from "react";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Slide,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import InboxIcon from "@mui/icons-material/Inbox";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { LeftPanelToggle, RightPanelToggle } from "../Panels/LeftPanelToggle";
import SearchBar from "../search/SearchBar";
import { M1, M2, M4, TOP_BAR_ELEVATION } from "../../statics";
import { useContainedIfSelected, Pages } from "./Pages";
import { useLayout } from "../../LayoutProvider";

export interface TopBarAppBarProps {
  /** Avatar click handler; receives the avatar DOM as Menu anchorEl. */
  onOpenUserMenu: (anchorEl: HTMLElement) => void;
  /** Bell click handler; receives the bell DOM as Popover anchorEl. */
  onOpenNotifications: (anchorEl: HTMLElement) => void;
  /** false -> red dot is shown on the bell (services unreachable). */
  servicesReachable: boolean;
}

/**
 * AppBar + Toolbar body. Pure presentational apart from nav
 * hooks. Parent owns open/close state for the menu + popover.
 */
export const TopBarAppBar: React.FC<TopBarAppBarProps> = ({
  onOpenUserMenu,
  onOpenNotifications,
  servicesReachable,
}) => {
  const { theme, themeName, setTheme, customThemes } = useThemeStore();
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { showTopBar } = useLayout();
  const homeVariant = useContainedIfSelected(Pages.HOME);
  const graphVariant = useContainedIfSelected(Pages.GRAPH);

  // Slide wraps the position:fixed AppBar directly; a static Box
  // wrapper would un-anchor the slide target and kill the animation.
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
      <AppBar position="fixed" elevation={TOP_BAR_ELEVATION}>
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
            <LeftPanelToggle />

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

            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                minWidth: 3 / 10,
              }}
            >
              <SearchBar />
            </Box>

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
                    "& .MuiSelect-select": { py: "0.35rem" },
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
              <NotificationsButton
                onOpen={onOpenNotifications}
                servicesReachable={servicesReachable}
              />
              <Button
                onClick={(e) => onOpenUserMenu(e.currentTarget)}
                color="inherit"
              >
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

/** Plain avatar wrapper; parent owns the click handler. */
const UserAvatarButton: React.FC<{
  user: ReturnType<typeof useUser>["data"];
}> = ({ user }) => (
  <Avatar
    sx={{ width: 50, height: 50 }}
    src={user ? user.getAvatarUrl() : undefined}
    alt={user ? user.username : ""}
  />
);

/** Bell + red dot indicating unreachable services. */
const NotificationsButton: React.FC<{
  onOpen: (anchorEl: HTMLElement) => void;
  servicesReachable: boolean;
}> = ({ onOpen, servicesReachable }) => {
  const button = (
    <IconButton
      color="inherit"
      aria-label={
        servicesReachable
          ? "Open notifications"
          : "Open notifications — backend services unreachable"
      }
      onClick={(e) => onOpen(e.currentTarget)}
    >
      <Badge
        color="error"
        variant="dot"
        invisible={servicesReachable}
        overlap="circular"
      >
        <InboxIcon />
      </Badge>
    </IconButton>
  );
  return servicesReachable ? (
    button
  ) : (
    <Tooltip title="Backend services unreachable — see Settings">
      {button}
    </Tooltip>
  );
};

export default TopBarAppBar;
