import {
  Avatar,
  Badge,
  Box,
  Divider,
  IconButton,
  Menu,
  Popover,
  Stack,
  Tooltip,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import React, { useState } from "react";
import { M1 } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useUser } from "../../api/queries/useUser";
import { useServiceReachability } from "./useServiceReachability";
import { UserMenu } from "./UserMenu";
import { NotificationsPanel } from "./NotificationsPanel";
import { ServiceFailureDialog } from "./ServiceFailureDialog";
import {
  selectSortedTopBarSlots,
  useTopBarStore,
} from "../../zustand/useTopBarStore";

/**
 * Right cluster of the desktop top bar: plug-in slots, the vertical
 * divider, the notifications bell, the user avatar, and the popovers
 * / menu / service-failure dialog anchored to those buttons.
 *
 * Extracted from :class:`DesktopTopBar` so that:
 *
 *   - changes to `useTopBarStore.slots` (contributor mounts, the
 *     right rail opening / closing) re-render only this subtree
 *     and never touch the wordmark, search bar or panel toggles;
 *   - changes to the bell red dot (`useServiceReachability`) and
 *     popover open / close only re-render the buttons and anchors
 *     they own;
 *   - the top bar's scroll-driven `showTopPanel` flips cascade
 *     through `<Slide>`'s box wrapper but stop here thanks to the
 *     `React.memo` wrap on the export.
 *
 * Holds its own anchors (`userMenuAnchor`, `notificationsAnchor`)
 * so popping a menu or notification never reaches the surrounding
 * chrome.
 */
const TopBarRightClusterImpl: React.FC = () => {
  const { rightPanel } = useLayout();
  const reachability = useServiceReachability();
  const { data: user } = useUser();

  // Local anchors: opening / closing the user menu or notifications
  // popover only re-renders this subtree. Kept here (rather than
  // lifted into the parent) so the popovers travel with the
  // buttons they anchor to.
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [notificationsAnchor, setNotificationsAnchor] =
    useState<HTMLElement | null>(null);

  // Slots render whenever a right rail is mounted -- the toolbar
  // is wired into the top bar at all times, independent of whether
  // the rail is open or closed. Routes without a right rail
  // (home, settings, ...) don't contribute anything; the rail's
  // own toolbar mount has been removed (the rail only hosts the
  // content panels now), so there is no double-up risk. The
  // registry itself lives in `useTopBarStore`.
  const slotEntries = useTopBarStore((s) => s.slots);
  const showSlots = rightPanel !== null;
  const sortedSlots = showSlots ? selectSortedTopBarSlots(slotEntries) : [];

  return (
    <>
      <Stack direction="row" spacing={M1} sx={{ alignItems: "center" }}>
        {sortedSlots.map(({ id, Component }) => (
          <Box key={id} sx={{ display: "flex" }}>
            <Component />
          </Box>
        ))}
        {sortedSlots.length > 0 && (
          <Divider
            orientation="vertical"
            flexItem
            sx={{ my: 1, opacity: 0.5 }}
          />
        )}
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
    </>
  );
};

/**
 * Memoised so a re-render of `:class:`DesktopTopBar` for an unrelated
 * reason (e.g. `showTopPanel` flipping on scroll) doesn't push a
 * re-render through the cluster's `useServiceReachability` poll, its
 * user-avatar re-read, or its anchor state. The cluster has no props,
 * so the shallow comparison is exact.
 */
export const TopBarRightCluster = React.memo(TopBarRightClusterImpl);
