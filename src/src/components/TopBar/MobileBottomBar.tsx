import {
  Avatar,
  Badge,
  Box,
  IconButton,
  Menu,
  Paper,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { M1, M2, M3 } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";
import { usePublicUserStore } from "../../zustand/usePublicUserStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { PublicUserAvatar } from "./PublicUserAvatar";
import { SearchResultsOverlay } from "../search/Main";
import { useServiceReachability } from "./useServiceReachability";
import { useMobileActionsStore } from "../../zustand/useMobileActionsStore";
import { UserMenu } from "./UserMenu";
import { NotificationsPanel } from "./NotificationsPanel";
import { ServiceFailureDialog } from "./ServiceFailureDialog";

/**
 * Minimum horizontal travel (px) before a swipe is recognised as
 * a panel-open / panel-close gesture. Smaller than this is treated
 * as a tap and falls through to the avatar/bell click handlers.
 */
const SWIPE_MIN_PX = 64;
/**
 * Maximum vertical drift (px) allowed during a horizontal swipe.
 * Anything larger means the user is scrolling, not swiping.
 */
const SWIPE_MAX_DRIFT_PX = 24;
/**
 * Minimum vertical travel (px) before a swipe-up is recognised as
 * a "go home" gesture. Smaller than this is treated as a tap.
 */
const SWIPE_UP_MIN_PX = 64;
/**
 * Maximum horizontal drift (px) allowed during a vertical swipe.
 */
const SWIPE_UP_MAX_DRIFT_PX = 24;

/**
 * Mobile bottom bar (Discord-inspired):
 *
 *   - Pill-shaped container pinned to the bottom of the viewport.
 *   - Avatar sits inside the bar (no upward overflow); tapping it
 *     opens the user menu.
 *   - Username with chevron in the middle.
 *   - Search shortcut and notifications bell on the right;
 *     service reachability drives the bell's red dot.
 *   - iOS-style home indicator strip below the bar.
 *
 * Unlike `DesktopTopBar`, this is always visible: mobile chrome
 * doesn't auto-hide on scroll because there's no chrome above the
 * canvas to reclaim.
 *
 * Horizontal swipes are the only way to open / close the side
 * rails on mobile (there are no collapse buttons): swipe right
 * toggles the left rail, swipe left toggles the right rail. The
 * two drawers are mutually exclusive, and a swipe towards an open
 * drawer closes it. The gesture works on every route; a rail that
 * isn't mounted on the current page simply ignores the swipe.
 *
 * A swipe up on the bar navigates to `/` (home) from any other
 * route. The two axes are decided by the dominant direction at
 * `pointerup`, so a horizontal swipe that drifts vertically a bit
 * never triggers "go home" and vice versa.
 */
export const MobileBottomBar: React.FC = () => {
  const { theme } = useThemeStore();
  const reachability = useServiceReachability();
  const { data: user } = useUser();
  const { isPublic } = usePublicRouteReady({ timeoutMs: 0 });
  // Anonymous viewers on a public share: no Discord profile, so the
  // avatar falls back to the generated public handle's initials and
  // the label shows that handle instead of "Not signed in".
  const isAnonymousPublic = isPublic && !user;
  const publicUserName = usePublicUserStore((s) => s.name);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDialogOpen = useSearchNotesStore((s) => s.isDialogOpen);
  const setIsDialogOpen = useSearchNotesStore((s) => s.setIsDialogOpen);
  const {
    leftPanel,
    leftPanelOpen,
    setLeftPanelOpen,
    setLeftPanelUserOverride,
    rightPanel,
    rightPanelOpen,
    setRightPanelOpen,
    setRightPanelUserOverride,
    showTopPanel: showBottomBar,
  } = useLayout();
  const actionsByOwner = useMobileActionsStore((s) => s.actionsByOwner);
  const mobileActions = useMemo(
    () => Object.values(actionsByOwner).flat(),
    [actionsByOwner],
  );

  // Anchors for the user menu and notifications popover
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [notificationsAnchor, setNotificationsAnchor] =
    useState<HTMLElement | null>(null);

  // Swipe state. Lives in a ref so it never re-renders the bar
  // mid-swipe; the up-handler is the only consumer.
  const swipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    triggered: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    triggered: false,
  });

  const isHome = pathname === "/";

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      triggered: false,
    };
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    // Only the pointer that started the swipe can finish it.
    if (swipe.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    swipe.pointerId = null;
    // Decide axis by dominant direction. Vertical-dominant swipes
    // never reach the horizontal handlers below, and horizontal
    // swipes never reach the vertical handler -- the two stay
    // independent.
    if (Math.abs(dy) > Math.abs(dx)) {
      if (-dy >= SWIPE_UP_MIN_PX && Math.abs(dx) <= SWIPE_UP_MAX_DRIFT_PX) {
        // Swipe up: navigate home. Already on home? No-op so we
        // don't waste a render.
        if (!isHome) {
          swipe.triggered = true;
          navigate("/");
        }
      }
      return;
    }
    if (Math.abs(dy) > SWIPE_MAX_DRIFT_PX) {
      return;
    }
    if (dx >= SWIPE_MIN_PX) {
      // Swipe right: close an open right drawer first, otherwise
      // toggle the left rail. The two drawers are mutually
      // exclusive, so a swipe towards one closes the other.
      if (rightPanelOpen) {
        swipe.triggered = true;
        setRightPanelOpen(false);
        setRightPanelUserOverride(true);
      } else if (leftPanel !== null) {
        swipe.triggered = true;
        setLeftPanelOpen(!leftPanelOpen);
        setLeftPanelUserOverride(true);
      }
      return;
    }
    if (-dx >= SWIPE_MIN_PX) {
      // Swipe left: close an open left drawer first, otherwise
      // toggle the right rail.
      if (leftPanelOpen) {
        swipe.triggered = true;
        setLeftPanelOpen(false);
        setLeftPanelUserOverride(true);
      } else if (rightPanel !== null) {
        swipe.triggered = true;
        setRightPanelOpen(!rightPanelOpen);
        setRightPanelUserOverride(true);
      }
      return;
    }
  };
  const handlePointerCancel = () => {
    swipeRef.current.pointerId = null;
  };

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          left: M3,
          right: M3,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          zIndex: (t) => t.zIndex.appBar,
          color: theme.palette.text.primary,
          borderRadius: 9999,
          boxShadow: theme.shadows[6],
          paddingInline: M3,
          paddingBlock: "0.625rem",
          display: "flex",
          alignItems: "center",
          gap: M2,
          // Hide with the topbar on scroll down; return on scroll up.
          transform: showBottomBar ? "translateY(0)" : "translateY(200%)",
          opacity: showBottomBar ? 1 : 0,
          pointerEvents: showBottomBar ? "auto" : "none",
          transition: theme.transitions.create(["transform", "opacity"], {
            duration: theme.transitions.duration.standard,
            easing: theme.transitions.easing.easeInOut,
          }),
          // Disable the browser's native scroll/pan while the swipe is in
          // progress: the bar captures both horizontal swipes (rail
          // toggle) and vertical swipes (navigate home) via
          // pointer events, so neither axis can be left to the
          // browser. The bar itself isn't scrollable, and the
          // canvas behind it has plenty of room to scroll.
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        // After a swipe we toggled the rail; suppress the
        // synthetic click that browsers fire at the up-target so
        // the avatar / bell buttons don't also open their
        // popovers from the same gesture.
        onClickCapture={(event) => {
          if (swipeRef.current.triggered) {
            event.stopPropagation();
            event.preventDefault();
            swipeRef.current.triggered = false;
          }
        }}
      >
        {/* Avatar: sits inside the bar (no upward overflow).
            Tap to open the user menu. */}
        <Box sx={{ flexShrink: 0 }}>
          <Tooltip
            title={
              isAnonymousPublic
                ? publicUserName
                : user
                  ? user.username
                  : "Open user menu"
            }
          >
            <IconButton
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              size="medium"
              sx={{ padding: 0 }}
            >
              {isAnonymousPublic ? (
                <PublicUserAvatar size={44} fontSize={16} />
              ) : (
                <Avatar
                  src={user ? user.getAvatarUrl() : undefined}
                  alt={user ? user.username : ""}
                  sx={{ width: 44, height: 44 }}
                />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Username + Online subtitle, stacked. Tap anywhere on
            the text block to also open the user menu. */}
        <Stack
          spacing={0}
          sx={{
            flex: 1,
            minWidth: 0,
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={(e) => setUserMenuAnchor(e.currentTarget as HTMLElement)}
        >
          <Typography
            variant="body1"
            noWrap
            sx={{
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              color: theme.palette.text.primary,
            }}
          >
            {isAnonymousPublic
              ? publicUserName
              : user
                ? user.username
                : "Not signed in"}
            <Box
              component="span"
              sx={{
                fontSize: "0.75em",
                color: theme.palette.text.secondary,
              }}
            >
              {"\u2304"}
            </Box>
          </Typography>
        </Stack>

        {/* Right cluster: page / editor actions + search shortcut +
            notifications bell. The search shortcut mirrors the desktop
            top bar's SearchBar: Ctrl+K / tap opens the search dialog. */}
        <Stack direction="row" spacing={M1} sx={{ alignItems: "center" }}>
          {/* Page-provided actions (e.g. the create FABs) render here
              on mobile instead of floating over the canvas. */}
          {mobileActions.map((action) => (
            <Tooltip key={action.id} title={action.label}>
              <IconButton
                onClick={action.onClick}
                size="medium"
                aria-label={action.label}
                disabled={action.disabled}
                sx={{ p: 1 }}
              >
                {action.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Search (Ctrl+K)">
            <IconButton
              onClick={() => setIsDialogOpen(true)}
              size="medium"
              sx={{ p: 1 }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              reachability.servicesReachable
                ? "Open notifications"
                : "Backend services unreachable"
            }
          >
            <IconButton
              onClick={(e) => setNotificationsAnchor(e.currentTarget)}
              size="medium"
              sx={{ p: 1 }}
            >
              <Badge
                color="error"
                variant="dot"
                invisible={reachability.servicesReachable}
                overlap="circular"
              >
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <UserMenu onRequestClose={() => setUserMenuAnchor(null)} />
      </Menu>
      <Popover
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={() => setNotificationsAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { width: 320, maxWidth: "calc(100vw - 2rem)" },
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
      {/* Mobile search shortcut mirrors the desktop `SearchBar`:
          the overlay has to be mounted here too because the
          desktop `SearchBar` (which owns the overlay) only
          renders on >= md breakpoints. */}
      <SearchResultsOverlay
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
};
