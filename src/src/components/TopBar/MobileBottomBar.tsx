import {
  alpha,
  Avatar,
  Box,
  IconButton,
  MenuList,
  Paper,
  Stack,
  SwipeableDrawer,
  Tooltip,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
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
import { useMobileActionsStore } from "../../zustand/useMobileActionsStore";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { UserMenu } from "./UserMenu";

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
 * Shared styling for the bar's right-cluster icon buttons. Drops the
 * chunky Material padding so the glyphs themselves can be larger
 * (28px instead of 24px) without growing the bar.
 */
const iconButtonSx = {
  p: 0.5,
  "& .MuiSvgIcon-root": { fontSize: 28 },
};

/**
 * Mobile bottom bar (Discord-inspired):
 *
 *   - Pill-shaped container pinned to the bottom of the viewport.
 *   - Avatar sits inside the bar (no upward overflow); tapping it
 *     opens the user menu.
 *   - Username with chevron in the middle.
 *   - Search shortcut and a hide-bar chevron on the right.
 *   - iOS-style home indicator strip below the bar.
 *
 * Like the desktop top panel, it hides while scrolling down and
 * returns while scrolling up. The AppShell drives this through the
 * shared `showTopPanel` scroll watchdog on every mobile route, so the
 * behaviour is identical on Home, directory and note pages.
 *
 * The right-hand chevron hides the bar on demand (it sets
 * `showTopPanel` to false); while hidden, a floating chevron at the
 * bottom edge brings it back. Notifications no longer live here --
 * they are reached from the user menu (`UserMenu` ->
 * Notifications).
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
  // Match the main shell surface: with FlatLayout the canvas is
  // `background.default`, so the bar should use the same tone instead
  // of a contrasting paper block floating above the page.
  const flatLayout = useFeatureStore(
    (s) => s.flags[FeatureFlagName.FlatLayout],
  );
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
    setShowTopPanel,
  } = useLayout();
  const actionsByOwner = useMobileActionsStore((s) => s.actionsByOwner);
  const mobileActions = useMemo(
    () => Object.values(actionsByOwner).flat(),
    [actionsByOwner],
  );

  // The user menu opens as a draggable bottom drawer on mobile.
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
          backgroundColor: flatLayout
            ? theme.palette.background.default
            : undefined,
          borderRadius: 9999,
          boxShadow: theme.shadows[6],
          paddingInline: M2,
          paddingBlock: "0.25rem",
          display: "flex",
          alignItems: "center",
          gap: M1,
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
        {/* Username + Online subtitle, stacked. Tap anywhere on
            the text block to also open the user menu. */}
        <Stack
          spacing={2}
          sx={{
            flex: 1,
            minWidth: 0,
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setUserMenuOpen(true)}
          direction={"row"}
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
                onClick={() => setUserMenuOpen(true)}
                size="medium"
                sx={{ padding: 0 }}
              >
                {isAnonymousPublic ? (
                  <PublicUserAvatar size={60} fontSize={20} />
                ) : (
                  <Avatar
                    src={user ? user.getAvatarUrl() : undefined}
                    alt={user ? user.username : ""}
                    sx={{ width: 52, height: 52 }}
                  />
                )}
              </IconButton>
            </Tooltip>
          </Box>
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
            the hide-bar control. The search shortcut mirrors the
            desktop top bar's SearchBar: Ctrl+K / tap opens the
            search dialog. Notifications moved into the user menu. */}
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
                sx={iconButtonSx}
              >
                {action.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Search (Ctrl+K)">
            <IconButton
              onClick={() => setIsDialogOpen(true)}
              size="medium"
              sx={iconButtonSx}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Hide bar">
            <IconButton
              onClick={() => setShowTopPanel(false)}
              size="medium"
              aria-label="Hide bottom bar"
              sx={iconButtonSx}
            >
              <KeyboardArrowDownIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Collapsed-state affordance: when the bar has slid away
          (scroll down or manual hide), a small floating chevron at
          the bottom edge brings it back. */}
      <Tooltip title="Show bar">
        <IconButton
          onClick={() => setShowTopPanel(true)}
          aria-label="Show bottom bar"
          sx={{
            position: "fixed",
            left: "50%",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
            transform: `translateX(-50%) translateY(${
              showBottomBar ? "200%" : "0"
            })`,
            opacity: showBottomBar ? 0 : 1,
            pointerEvents: showBottomBar ? "none" : "auto",
            zIndex: (t) => t.zIndex.appBar,
            color: theme.palette.text.primary,
            backgroundColor: flatLayout
              ? theme.palette.background.default
              : theme.palette.background.paper,
            boxShadow: theme.shadows[6],
            transition: theme.transitions.create(["transform", "opacity"], {
              duration: theme.transitions.duration.standard,
              easing: theme.transitions.easing.easeInOut,
            }),
          }}
        >
          <KeyboardArrowUpIcon />
        </IconButton>
      </Tooltip>

      {/* User menu as a draggable bottom sheet: drag the handle (or
          swipe) down, tap the scrim, or pick a row to dismiss. */}
      <SwipeableDrawer
        anchor="bottom"
        open={userMenuOpen}
        onOpen={() => setUserMenuOpen(true)}
        onClose={() => setUserMenuOpen(false)}
        disableSwipeToOpen
        // Wide grab strip at the top edge so the pull-down-to-close
        // gesture is easy to discover.
        swipeAreaWidth={56}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: flatLayout
                ? theme.palette.background.default
                : theme.palette.background.paper,
              borderTopLeftRadius: M3,
              borderTopRightRadius: M3,
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              maxHeight: "85%",
              // Clear the iOS home indicator / safe area.
              pb: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
            },
          },
          backdrop: {
            sx: {
              backgroundColor: alpha(
                theme.blendAgainstContrast(
                  theme.palette.background.default,
                  0.5,
                  undefined,
                ),
                0.8,
              ),
            },
          },
        }}
      >
        {/* `pan-y` lets the menu scroll while the drawer's own
            swipe-down-to-close gesture still works. */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            touchAction: "pan-y",
            pt: M1,
          }}
        >
          {/* Drag handle: visible affordance for the swipe-down
              gesture. The drawer's swipe area already captures the
              top strip, this is just the cue. */}
          <Box
            aria-hidden
            onClick={() => setUserMenuOpen(false)}
            sx={{
              alignSelf: "center",
              width: 100,
              height: 4,
              borderRadius: 9999,
              mb: M1,
              backgroundColor: alpha(theme.palette.text.primary, 0.4),
              "&:hover": {
                backgroundColor: alpha(theme.palette.text.primary, 0.6),
              },
              transition: theme.transitions.create("background-color", {
                duration: theme.transitions.duration.short,
              }),
            }}
          />
          {/* `MenuList` supplies the context `MenuItem`s require.
              `component="div"` keeps the drawer's non-menu chrome
              (profile header, theme picker) from being emitted as
              invalid `<div>`s inside a `<ul>`. */}
          <MenuList component="div" sx={{ py: 0 }}>
            <UserMenu onRequestClose={() => setUserMenuOpen(false)} />
          </MenuList>
        </Box>
      </SwipeableDrawer>
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
