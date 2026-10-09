import React from "react";
import {
  Avatar,
  Box,
  Divider,
  FormControl,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import HomeIcon from "@mui/icons-material/Home";
import LightModeIcon from "@mui/icons-material/LightMode";
import Logout from "@mui/icons-material/Logout";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { M1, M2, M4 } from "../../statics";
import { ThemeColorCircles } from "../ThemeColorCircles";
import { Pages } from "./Pages";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { handleLogout as performLogout } from "../../utils/logout";

export interface UserMenuProps {
  /** Fired after the user picks a row; parent closes the surrounding Menu. */
  onRequestClose: () => void;
}

/**
 * Avatar Menu body: profile header, theme selector, Pages (Home,
 * Graph, Rules), Settings, Logout. Theme switching keeps the menu
 * open so the user can see the theme update live; the other rows
 * close it. Notifications live on a dedicated bell button.
 */
export const UserMenu: React.FC<UserMenuProps> = ({ onRequestClose }) => {
  const {
    theme,
    themeName,
    setTheme,
    customThemes,
    lastLightTheme,
    lastDarkTheme,
  } = useThemeStore();
  const { data: user } = useUser();
  const navigate = useNavigate();
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);

  // Drop identity on the backend (best-effort) and clear every
  // identity-shaped zustand store + the React Query cache so the
  // previous user's data doesn't flash on the next session.
  const handleLogout = async () => {
    await performLogout();
    onRequestClose();
  };

  const handleOpenSettings = () => {
    navigate(Pages.SETTINGS);
    onRequestClose();
  };

  const handleOpenGraph = () => {
    navigate(Pages.GRAPH);
    onRequestClose();
  };

  const handleOpenHome = () => {
    navigate(Pages.HOME);
    onRequestClose();
  };

  // Rules live at /shelves/:id/rules, so we need a shelf id.
  // Falls back to home when none is selected.
  const handleOpenRules = () => {
    if (selectedShelfId !== null) {
      navigate(`/shelves/${selectedShelfId}/rules`);
    } else {
      navigate(Pages.HOME);
    }
    onRequestClose();
  };
  const rulesDisabled = selectedShelfId === null;

  // Active theme -> "dark" | "light". The store exposes the live
  // MUI theme on `theme.palette.mode`; "dark" is the fallback so
  // a half-hydrated theme object never disables the toggle.
  const currentMode = theme.palette.mode === "light" ? "light" : "dark";

  // Filter the Select to the active mode. Keeps the dropdown
  // narrow: picking a dark theme filters out the light ones and
  // vice versa.
  const filteredThemes = customThemes.filter(
    (t) => (t.palette.mode === "light" ? "light" : "dark") === currentMode,
  );

  // If the active themeName isn't in the filtered set (e.g. the
  // stored theme is the other mode), fall back to the first item
  // so the Select keeps a valid value while the toggle is being
  // clicked. Render-only — never writes back to the store.
  const selectValue = filteredThemes.some(
    (t) => t.custom.themeName === themeName,
  )
    ? themeName
    : (filteredThemes[0]?.custom.themeName ?? "");

  // Toggle: prefer the last theme the user had on for the other
  // mode (so light -> dark -> light returns to the same light
  // theme they were on before). Fall back to the first theme of
  // the other mode when the user has never picked one in this
  // mode on this device.
  const otherMode: "dark" | "light" = currentMode === "dark" ? "light" : "dark";
  const lastUsedOther = otherMode === "light" ? lastLightTheme : lastDarkTheme;
  const toggleTooltip =
    currentMode === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const handleToggleMode = () => {
    const next = lastUsedOther
      ? customThemes.find((t) => t.custom.themeName === lastUsedOther)
      : customThemes.find((t) => {
          const m = t.palette.mode === "light" ? "light" : "dark";
          return m === otherMode;
        });
    if (next) void setTheme(next.custom.themeName);
  };

  return (
    // minWidth hints the Menu past the longest text so the profile
    // header doesn't squeeze.
    <Stack sx={{ minWidth: 280 }}>
      <Stack
        spacing={M2}
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "flex-start",
          px: M2,
          py: M1,
        }}
      >
        <Avatar
          sx={{ width: 36, height: 36 }}
          src={user?.getAvatarUrl()}
          alt={user?.username ?? ""}
        />
        <Typography
          variant="body1"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.username ?? "Guest"}
        </Typography>
      </Stack>

      <Divider />

      <SectionLabel>Theme</SectionLabel>
      <Box
        sx={{
          px: M2,
          pb: M2,
          display: "flex",
          alignItems: "center",
          gap: M1,
        }}
      >
        <Tooltip title={toggleTooltip}>
          <span>
            <IconButton
              size="small"
              onClick={handleToggleMode}
              aria-label={toggleTooltip}
              color="inherit"
              sx={{ flexShrink: 0 }}
            >
              {currentMode === "dark" ? (
                <DarkModeIcon fontSize="small" />
              ) : (
                <LightModeIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
          <Select
            value={selectValue}
            onChange={(event) => setTheme(event.target.value)}
            sx={{ borderRadius: M4 }}
            inputProps={{ "aria-label": "Select theme" }}
            renderValue={(value) => {
              const selected = filteredThemes.find(
                (t) => t.custom.themeName === value,
              );
              if (!selected) return null;
              return (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minHeight: 30,
                  }}
                >
                  <ThemeColorCircles theme={selected} circleSize={16} />
                  {selected.custom.longName}
                </Box>
              );
            }}
          >
            {filteredThemes.map((t) => (
              <MenuItem
                key={t.custom.themeName}
                value={t.custom.themeName}
                sx={{ gap: 1, minHeight: 52 }}
              >
                <ThemeColorCircles theme={t} circleSize={16} />
                {t.custom.longName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider />

      <SectionLabel>Pages</SectionLabel>
      <MenuItem
        onClick={handleOpenHome}
        sx={{
          "&:hover": { backgroundColor: theme.palette.action.hover },
          minHeight: 52,
        }}
      >
        <ListItemIcon>
          <HomeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Home" />
      </MenuItem>
      <MenuItem
        onClick={handleOpenGraph}
        sx={{
          "&:hover": { backgroundColor: theme.palette.action.hover },
          minHeight: 52,
        }}
      >
        <ListItemIcon>
          <AccountTreeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Graph" />
      </MenuItem>
      <MenuItem
        onClick={handleOpenRules}
        disabled={rulesDisabled}
        sx={{
          "&:hover": { backgroundColor: theme.palette.action.hover },
          minHeight: 52,
        }}
      >
        <ListItemIcon>
          <RuleFolderIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="Rules"
          secondary={rulesDisabled ? "Pick a shelf first" : undefined}
        />
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={handleOpenSettings}
        sx={{
          "&:hover": { backgroundColor: theme.palette.action.hover },
          minHeight: 52,
        }}
      >
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Settings" />
      </MenuItem>
      <MenuItem
        onClick={handleLogout}
        sx={{
          "&:hover": { backgroundColor: theme.palette.action.hover },
          minHeight: 52,
        }}
      >
        <ListItemIcon>
          <Logout fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </MenuItem>
    </Stack>
  );
};

/**
 * Small overline used as a section header inside the menu
 * (e.g. above the theme list and the Pages list). Inline rather
 * than `ListSubheader` so it sits flush against the Stack padding
 * without picking up the ListSubheader background.
 */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography
    variant="overline"
    sx={{ px: M2, pt: M1, display: "block", color: "text.secondary" }}
  >
    {children}
  </Typography>
);

export default UserMenu;
