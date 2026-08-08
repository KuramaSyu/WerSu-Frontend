import {
  Avatar,
  Badge,
  Box,
  IconButton,
  Menu,
  Popover,
  Slide,
  Stack,
  Tooltip,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { M1, M2, M3, M5 } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { useServiceReachability } from "./useServiceReachability";
import { UserMenu } from "./UserMenu";
import { NotificationsPanel } from "./NotificationsPanel";
import { ServiceFailureDialog } from "./ServiceFailureDialog";
import { SearchBar } from "../search/SearchBar";
import { LeftPanelToggle, RightPanelToggle } from "../Panels/LeftPanelToggle";

/**
 * Desktop top bar chrome:
 *
 *   - WerSu wordmark (left)
 *   - Centred SearchBar
 *   - Notifications bell + user avatar (right)
 *   - Left/right rail collapse toggles at the far edges
 *
 * Sits in a `Slide` whose visibility is driven by
 * `LayoutProvider.showTopPanel` (the AppShell flips that on scroll).
 * The two popovers (user menu, notifications) and the service-failure
 * dialog are owned here so AppShell doesn't need to thread their
 * anchors down.
 *
 * The wordmark click navigates to "/" via `react-router-dom`.
 */
export const DesktopTopBar: React.FC = () => {
  const { showTopPanel } = useLayout();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const reachability = useServiceReachability();
  const { data: user } = useUser();

  // Anchors for the user menu and notifications popover
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [notificationsAnchor, setNotificationsAnchor] =
    useState<HTMLElement | null>(null);

  return (
    <Slide
      appear={false}
      direction="down"
      in={showTopPanel}
      timeout={theme.transitions.duration.standard}
      easing={{
        enter: theme.transitions.easing.easeInOut,
        exit: theme.transitions.easing.easeInOut,
      }}
    >
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          display: "flex",
          alignItems: "center",
          gap: M2,
          px: M3,
          height: M5,
          backgroundColor: theme.palette.background.default,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Far-left: collapse / expand the left rail */}
        <LeftPanelToggle />

        {/* Left cluster: WerSu wordmark (clickable -> /) */}
        <Box
          onClick={() => navigate("/")}
          sx={{
            cursor: "pointer",
            userSelect: "none",
            fontFamily: '"Fira Sans", sans-serif',
            fontWeight: 300,
            fontSize: theme.typography.h4.fontSize,
            color: theme.palette.text.primary,
            whiteSpace: "nowrap",
          }}
        >
          WerSu
        </Box>

        {/* Centre: search bar sits centred between the
            auto-width wordmark (left) and the right cluster.
            The wrapper only takes the search bar's clamped
            width; `margin: auto` pushes the leftover space
            equally to both sides so it always lines up with
            the page centre, regardless of the top panel's
            total width. */}
        <Box sx={{ margin: "auto" }}>
          <SearchBar />
        </Box>

        {/* Right cluster: notifications bell + avatar. Anchors
            the user menu (theme + settings + pages + logout)
            and the notifications popover. Service-reachability
            drives the bell's red dot. */}
        <Stack direction="row" spacing={M1} sx={{ alignItems: "center" }}>
          <Tooltip
            title={
              reachability.servicesReachable
                ? "Open notifications"
                : "Backend services unreachable"
            }
          >
            <IconButton
              onClick={(e) => setNotificationsAnchor(e.currentTarget)}
              size="small"
            >
              <Badge
                color="error"
                variant="dot"
                invisible={reachability.servicesReachable}
                overlap="circular"
              >
                <InboxIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <IconButton
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            size="small"
          >
            <Avatar
              sx={{ width: 36, height: 36 }}
              src={user ? user.getAvatarUrl() : undefined}
              alt={user ? user.username : ""}
            />
          </IconButton>
        </Stack>

        {/* Far-right: collapse / expand the right rail */}
        <RightPanelToggle />

        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={() => setUserMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <UserMenu onRequestClose={() => setUserMenuAnchor(null)} />
        </Menu>
        <Popover
          anchorEl={notificationsAnchor}
          open={Boolean(notificationsAnchor)}
          onClose={() => setNotificationsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              sx: { width: 420, maxWidth: "calc(100vw - 2rem)" },
            },
          }}
        >
          <NotificationsPanel />
        </Popover>
        <ServiceFailureDialog
          open={reachability.dialogOpen}
          unreachableServices={reachability.unreachableServices}
          onClose={reachability.dismissDialog}
          onIgnore={reachability.dismissDialog}
          onGoToSettings={reachability.goToSettings}
        />
      </Box>
    </Slide>
  );
};
