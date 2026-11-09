import React, { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CheckIcon from "@mui/icons-material/Check";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import EditIcon from "@mui/icons-material/Edit";
import HomeIcon from "@mui/icons-material/Home";
import LightModeIcon from "@mui/icons-material/LightMode";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import Logout from "@mui/icons-material/Logout";
import NotificationsIcon from "@mui/icons-material/Notifications";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import SettingsIcon from "@mui/icons-material/Settings";
import ShareIcon from "@mui/icons-material/Share";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../../zustand/useThemeStore";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useDevicePerformanceHint } from "../../hooks/useDevicePerformanceHint";
import { useUser } from "../../api/queries/useUser";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";
import {
  PUBLIC_USER_NAME_MAX_LENGTH,
  usePublicUserStore,
} from "../../zustand/usePublicUserStore";
import { PublicUserAvatar } from "./PublicUserAvatar";
import { ShelfCreateDialog } from "./ShelfCreateDialog";
import { ShelfSubmenu } from "./ShelfSubmenu";
import { M1, M2, M4 } from "../../statics";
import { ThemeColorCircles } from "../ThemeColorCircles";
import { ThemeEditModal } from "../ThemeEditModal";
import type { GeneratedThemeRecord } from "../../theme/imageTheme";
import { Pages } from "./Pages";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { useCloudPreferences } from "../../hooks/useCloudPreferences";
import { handleLogout as performLogout } from "../../utils/logout";
import useInfoStore from "../../zustand/InfoStore";
import { useNotificationsStore } from "../../zustand/useNotificationsStore";
import { useServiceReachability } from "./useServiceReachability";

export interface UserMenuProps {
  /** Fired after the user picks a row; parent closes the surrounding Menu. */
  onRequestClose: () => void;
}

/** Shared row treatment for the avatar menu. */
const menuItemSx = {
  mx: 0.75,
  my: 0.125,
  px: 1.25,
  minHeight: 44,
  gap: 1,
  borderRadius: 1.5,
  "&:hover": { backgroundColor: "action.hover" },
  "&.Mui-disabled": { opacity: 0.55 },
  "& .MuiListItemIcon-root": { minWidth: 32, color: "text.secondary" },
  "&:hover .MuiListItemIcon-root": { color: "primary.main" },
};

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
    selectTheme,
    customThemes,
    generatedThemes,
    syncedThemes,
    lastLightTheme,
    lastDarkTheme,
    themeLocked,
    setThemeLocked,
  } = useThemeStore();
  const { data: user } = useUser();
  const { isPublic } = usePublicRouteReady({ timeoutMs: 0 });
  const { canUpload, canDownload, isUploading, upload, progress, download } =
    useCloudPreferences();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  const notifications = useInfoStore((s) => s.logs);
  const setIsNotificationsOpen = useNotificationsStore(
    (s) => s.setIsDialogOpen,
  );
  const reachability = useServiceReachability();
  const { isSlowConnection, isBelow4G, networkQualityLabel } =
    useDevicePerformanceHint();
  // The avatar menu is the fast path for a genuinely slow link. Device
  // hints still surface the one-time suggestion in Settings > Network.
  const showPerformanceSection = isSlowConnection;
  const performanceHint = isBelow4G
    ? `${networkQualityLabel} network detected — Performance mode is recommended.`
    : "Slow connection detected — Performance mode is recommended.";

  // Unread count drives the menu row badge; "mark all as read" in the
  // panel flips every `readAt`, so this recomputes automatically.
  const unreadCount = notifications.reduce(
    (n, e) => n + (e.readAt === undefined ? 1 : 0),
    0,
  );
  const notificationsBadgeInvisible =
    unreadCount === 0 && reachability.servicesReachable;

  const handleOpenNotifications = () => {
    onRequestClose();
    setIsNotificationsOpen(true);
  };

  // Anonymous viewers on a public share can rename their generated
  // handle inline. Logged-in users keep the read-only Discord name.
  const isAnonymousPublic = isPublic && !user;
  const publicUserName = usePublicUserStore((s) => s.name);
  const setPublicUserName = usePublicUserStore((s) => s.setName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(publicUserName);
  // Generated theme being edited from the picker; null closes the modal.
  const [editingTheme, setEditingTheme] = useState<GeneratedThemeRecord | null>(
    null,
  );
  // Control the theme Select so opening the edit modal closes its list.
  const [themeSelectOpen, setThemeSelectOpen] = useState(false);
  // "Add new shelf" opens a dialog instead of navigating away, so the
  // mobile drawer can keep the user's current context while creating.
  const [isShelfDialogOpen, setIsShelfDialogOpen] = useState(false);

  // Generated and synced themes are editable; look their records up by slug.
  const editableThemes = useMemo(
    () => [...generatedThemes, ...syncedThemes],
    [generatedThemes, syncedThemes],
  );
  const editableThemesByName = useMemo(
    () => new Map(editableThemes.map((r) => [r.name, r])),
    [editableThemes],
  );

  const startEditingName = () => {
    setNameDraft(publicUserName);
    setIsEditingName(true);
  };

  const commitName = () => {
    setPublicUserName(nameDraft);
    setIsEditingName(false);
  };

  const cancelEditingName = () => setIsEditingName(false);

  // Drop identity on the backend (best-effort) and clear every
  // identity-shaped zustand store + the React Query cache so the
  // previous user's data doesn't flash on the next session.
  const handleLogout = async () => {
    try {
      await performLogout();
    } finally {
      // Always leave the current page, even if clearing the session
      // threw. The auth gate deliberately exempts /settings (so it
      // stays usable when logged out), which means clicking Logout
      // there would otherwise leave the top bar showing the previous
      // user's avatar. Logging out always means going to /login.
      onRequestClose();
      navigate("/login", { replace: true });
    }
  };

  const handleOpenSettings = () => {
    navigate(Pages.SETTINGS);
    onRequestClose();
  };

  const handleOpenGraph = () => {
    navigate(Pages.GRAPH);
    onRequestClose();
  };

  const handleOpenShortcuts = () => {
    navigate(Pages.SHORTCUTS);
    onRequestClose();
  };

  const handleOpenShares = () => {
    // Carry the app-wide selected shelf into the scope so the shares
    // page opens with the shelf the user is currently working in
    // already selected in its scope changer.
    navigate(
      selectedShelfId !== null
        ? `${Pages.SHARES}?shelf=${encodeURIComponent(selectedShelfId)}`
        : Pages.SHARES,
    );
    onRequestClose();
  };

  const handleOpenRoles = () => {
    navigate(Pages.ROLES);
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
  // Lock the device's current theme so synced preference changes stop
  // overriding it. Unlocked devices follow the synced preference.
  const lockTooltip = themeLocked
    ? "Theme pinned on this device. Cloud preferences are ignored."
    : "Pin this device's theme so cloud preferences are ignored.";
  const handleToggleThemeLock = () => setThemeLocked(!themeLocked);

  const otherMode: "dark" | "light" = currentMode === "dark" ? "light" : "dark";
  const lastUsedOther = otherMode === "light" ? lastLightTheme : lastDarkTheme;
  const toggleTooltip =
    currentMode === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const handleToggleMode = () => {
    // 1. The generated theme's own sibling variant (same image, other
    //    mode) is the most intuitive target.
    // 2. Otherwise the last theme used in the other mode.
    // 3. Otherwise any theme of that mode.
    const activeGenerated = editableThemesByName.get(themeName) ?? null;
    const sibling = editableThemes.find(
      (r) => r.groupId === activeGenerated?.groupId && r.mode === otherMode,
    );
    if (sibling !== undefined) {
      void selectTheme(sibling.name);
      return;
    }
    const lastUsed =
      lastUsedOther !== null
        ? customThemes.find((t) => t.custom.themeName === lastUsedOther)
        : undefined;
    const next =
      lastUsed ??
      customThemes.find((t) => {
        const m = t.palette.mode === "light" ? "light" : "dark";
        return m === otherMode;
      });
    if (next) void selectTheme(next.custom.themeName);
  };

  return (
    // minWidth hints the Menu past the longest text so the profile
    // header doesn't squeeze.
    <Stack
      sx={{
        minWidth: 300,
        maxWidth: "100%",
        maxHeight: "70vh",
        overflowY: "auto",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          backgroundColor: (t) =>
            alpha(
              t.palette.primary.main,
              t.palette.mode === "dark" ? 0.08 : 0.05,
            ),
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          spacing={1.25}
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {isAnonymousPublic ? (
            <PublicUserAvatar size={40} fontSize={15} />
          ) : (
            <Avatar
              sx={{ width: 40, height: 40 }}
              src={user?.getAvatarUrl()}
              alt={user?.username ?? ""}
            />
          )}
          {isAnonymousPublic && isEditingName ? (
            <TextField
              value={nameDraft}
              onChange={(event) =>
                setNameDraft(
                  event.target.value.slice(0, PUBLIC_USER_NAME_MAX_LENGTH),
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitName();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditingName();
                }
              }}
              size="small"
              autoFocus
              fullWidth
              slotProps={{
                htmlInput: { "aria-label": "Public display name" },
              }}
              sx={{ flex: 1, minWidth: 0 }}
            />
          ) : (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                noWrap
                sx={{ fontWeight: 600, lineHeight: 1.3 }}
              >
                {isAnonymousPublic
                  ? publicUserName
                  : (user?.username ?? "Guest")}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", lineHeight: 1.2 }}
              >
                {isAnonymousPublic ? "Public viewer" : "Signed in"}
              </Typography>
            </Box>
          )}
          {isAnonymousPublic && isEditingName && (
            <>
              <Tooltip title="Save name">
                <IconButton
                  size="small"
                  aria-label="Save display name"
                  onClick={commitName}
                  sx={{ flexShrink: 0 }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  aria-label="Cancel display name edit"
                  onClick={cancelEditingName}
                  sx={{ flexShrink: 0 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {isAnonymousPublic && !isEditingName && (
            <Tooltip title="Edit display name">
              <IconButton
                size="small"
                aria-label="Edit display name"
                onClick={startEditingName}
                sx={{ flexShrink: 0 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!isAnonymousPublic && (
            <>
              <Tooltip
                title={
                  isUploading
                    ? progress !== null
                      ? `${progress.message} (${progress.completed}/${progress.total})`
                      : "Uploading preferences…"
                    : canUpload
                      ? "Upload preferences to cloud"
                      : "Preferences are up to date"
                }
              >
                <span>
                  <IconButton
                    size="small"
                    aria-label="Upload preferences to cloud"
                    onClick={upload}
                    disabled={!canUpload || isUploading}
                    sx={{ flexShrink: 0 }}
                  >
                    {isUploading ? (
                      <CircularProgress
                        size={16}
                        variant={
                          progress !== null ? "determinate" : "indeterminate"
                        }
                        value={
                          progress !== null && progress.total > 0
                            ? (progress.completed / progress.total) * 100
                            : undefined
                        }
                        aria-label={
                          progress !== null
                            ? `Syncing ${progress.completed} of ${progress.total}`
                            : "Syncing preferences"
                        }
                      />
                    ) : (
                      <CloudUploadIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip
                title={
                  canDownload
                    ? "Load preferences from cloud"
                    : "No cloud preferences yet"
                }
              >
                <span>
                  <IconButton
                    size="small"
                    aria-label="Load preferences from cloud"
                    onClick={download}
                    disabled={!canDownload}
                    sx={{ flexShrink: 0 }}
                  >
                    <CloudDownloadIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Stack>
      </Box>

      <MenuItem
        onClick={handleOpenNotifications}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <Badge
            color={
              !reachability.servicesReachable && unreadCount === 0
                ? "error"
                : "primary"
            }
            variant={unreadCount > 0 ? "standard" : "dot"}
            badgeContent={unreadCount > 0 ? unreadCount : undefined}
            invisible={notificationsBadgeInvisible}
            overlap="circular"
          >
            <NotificationsIcon fontSize="small" />
          </Badge>
        </ListItemIcon>
        <ListItemText
          primary="Notifications"
          secondary={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        />
      </MenuItem>

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
            open={themeSelectOpen}
            onOpen={() => setThemeSelectOpen(true)}
            onClose={() => setThemeSelectOpen(false)}
            onChange={(event) => void selectTheme(event.target.value)}
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
            {filteredThemes.map((t) => {
              const generatedRecord =
                editableThemesByName.get(t.custom.themeName) ?? null;
              return (
                <MenuItem
                  key={t.custom.themeName}
                  value={t.custom.themeName}
                  sx={{ gap: 1, minHeight: 52 }}
                >
                  <ThemeColorCircles theme={t} circleSize={16} />
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.custom.longName}
                  </Box>
                  {generatedRecord !== null ? (
                    <Tooltip title="Edit theme">
                      <IconButton
                        size="small"
                        aria-label={`Edit theme ${t.custom.longName}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          // Keep the Select from selecting this row and
                          // close its list before the modal takes over.
                          e.stopPropagation();
                          e.preventDefault();
                          setThemeSelectOpen(false);
                          setEditingTheme(generatedRecord);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Tooltip title={lockTooltip}>
          <IconButton
            size="small"
            onClick={handleToggleThemeLock}
            aria-label={lockTooltip}
            aria-pressed={themeLocked}
            color={themeLocked ? "primary" : "inherit"}
            sx={{ flexShrink: 0 }}
          >
            {themeLocked ? (
              <LockIcon fontSize="small" />
            ) : (
              <LockOpenIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* The desktop top bar already has its own shelf switcher, so the
          avatar menu only offers shelf selection on mobile. */}
      {isMobile && (
        <>
          <Divider />
          <SectionLabel>Shelf</SectionLabel>
          <ShelfSubmenu
            onRequestClose={onRequestClose}
            onAddShelf={() => setIsShelfDialogOpen(true)}
            canAdd={!isAnonymousPublic}
          />
        </>
      )}

      <Divider />

      <SectionLabel>Pages</SectionLabel>
      <MenuItem
        onClick={handleOpenHome}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <HomeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Home" />
      </MenuItem>
      <MenuItem
        onClick={handleOpenGraph}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <AccountTreeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Graph" />
      </MenuItem>
      <MenuItem
        onClick={handleOpenRules}
        disabled={rulesDisabled}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <RuleFolderIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="Rules"
          secondary={rulesDisabled ? "Pick a shelf first" : undefined}
        />
      </MenuItem>
      <MenuItem
        onClick={handleOpenShares}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <ShareIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Shares" />
      </MenuItem>
      <MenuItem
        onClick={handleOpenRoles}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <AdminPanelSettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Roles" />
      </MenuItem>
      <MenuItem
        onClick={handleOpenShortcuts}
        sx={menuItemSx}
      >
        <ListItemIcon>
          <KeyboardIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Shortcuts" />
      </MenuItem>

      {showPerformanceSection && (
        <>
          <Divider />
          <SectionLabel>Performance</SectionLabel>
          <PerformanceMenuSection hint={performanceHint} />
        </>
      )}

      <Divider />

      <MenuItem
        onClick={handleOpenSettings}
        sx={{
          ...menuItemSx,
          "& .MuiListItemIcon-root": { color: "primary.main" },
          "&:hover .MuiListItemIcon-root": { color: "primary.main" },
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
          ...menuItemSx,
          color: "error.main",
          "&:hover": {
            backgroundColor: (t) => alpha(t.palette.error.main, 0.08),
          },
          "& .MuiListItemIcon-root": { color: "error.main" },
          "&:hover .MuiListItemIcon-root": { color: "error.main" },
        }}
      >
        <ListItemIcon>
          <Logout fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </MenuItem>

      <ThemeEditModal
        key={editingTheme?.id ?? "none"}
        record={editingTheme}
        open={editingTheme !== null}
        onClose={() => setEditingTheme(null)}
      />

      {isShelfDialogOpen && (
        <ShelfCreateDialog
          open={isShelfDialogOpen}
          onClose={() => setIsShelfDialogOpen(false)}
        />
      )}
    </Stack>
  );
};

/**
 * Compact Performance controls shown in the avatar menu when the device or
 * connection looks constrained. Mirrors the master switch + sub-flags in
 * Settings > Appearance without forcing a navigation away from the menu.
 */
const PerformanceMenuSection: React.FC<{ hint?: string }> = ({ hint }) => {
  const performanceMode = useFeatureStore(
    (s) => s.flags[FeatureFlagName.PerformanceMode],
  );
  const reduceMotion = useFeatureStore(
    (s) => s.flags[FeatureFlagName.ReduceMotion],
  );
  const disableBlur = useFeatureStore(
    (s) => s.flags[FeatureFlagName.DisableBlur],
  );
  const ignoreBackgroundImage = useFeatureStore(
    (s) => s.flags[FeatureFlagName.IgnoreBackgroundImage],
  );
  const setFlag = useFeatureStore((s) => s.setFlag);
  const setPerformanceMode = useFeatureStore((s) => s.setPerformanceMode);

  return (
    <Box sx={{ px: M2, pb: M2 }}>
      {hint !== undefined && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", pb: 0.5 }}
        >
          {hint}
        </Typography>
      )}
      <PerformanceSwitchRow
        label="Performance mode"
        checked={performanceMode}
        onChange={(checked) => setPerformanceMode(checked)}
        ariaLabel="Performance mode toggle"
      />
      <PerformanceSwitchRow
        label="Reduce motion"
        checked={reduceMotion}
        disabled={!performanceMode}
        onChange={(checked) => setFlag(FeatureFlagName.ReduceMotion, checked)}
        ariaLabel="Reduce motion toggle"
        indent
      />
      <PerformanceSwitchRow
        label="Disable blur"
        checked={disableBlur}
        disabled={!performanceMode}
        onChange={(checked) => setFlag(FeatureFlagName.DisableBlur, checked)}
        ariaLabel="Disable blur toggle"
        indent
      />
      <PerformanceSwitchRow
        label="Ignore background image"
        checked={ignoreBackgroundImage}
        disabled={!performanceMode}
        onChange={(checked) =>
          setFlag(FeatureFlagName.IgnoreBackgroundImage, checked)
        }
        ariaLabel="Ignore background image toggle"
        indent
      />
    </Box>
  );
};

const PerformanceSwitchRow: React.FC<{
  label: string;
  checked: boolean;
  disabled?: boolean;
  indent?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}> = ({
  label,
  checked,
  disabled = false,
  indent = false,
  ariaLabel,
  onChange,
}) => (
  <Stack
    direction="row"
    spacing={1}
    sx={{
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 40,
      pl: indent ? 2 : 0,
    }}
  >
    <Typography variant={indent ? "body2" : "subtitle2"}>{label}</Typography>
    <Switch
      size="small"
      checked={checked}
      disabled={disabled}
      onChange={(_, next) => onChange(next)}
      slotProps={{ input: { "aria-label": ariaLabel } }}
    />
  </Stack>
);

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
    sx={{
      px: 2,
      pt: 1.5,
      pb: 0.25,
      display: "flex",
      alignItems: "center",
      gap: 1,
      color: "text.secondary",
      fontSize: "0.6875rem",
      fontWeight: 700,
      letterSpacing: "0.1em",
      lineHeight: 1.4,
      "&::before": {
        content: '""',
        width: 12,
        height: 2,
        borderRadius: 999,
        backgroundColor: "primary.main",
        opacity: 0.7,
      },
    }}
  >
    {children}
  </Typography>
);

export default UserMenu;
