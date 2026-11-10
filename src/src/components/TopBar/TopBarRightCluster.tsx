import {
  Avatar,
  Box,
  Divider,
  IconButton,
  Menu,
  Stack,
} from "@mui/material";
import React, { useState } from "react";
import { M1 } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useUser } from "../../api/queries/useUser";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";
import { UserMenu } from "./UserMenu";
import { PublicUserAvatar } from "./PublicUserAvatar";
import {
  selectSortedTopBarSlots,
  useTopBarStore,
} from "../../zustand/useTopBarStore";

/**
 * Right cluster of the desktop top bar: plug-in slots, the vertical
 * divider, the user avatar, and the user menu.
 *
 * Extracted from :class:`DesktopTopBar` so that:
 *
 *   - changes to `useTopBarStore.slots` (contributor mounts, the
 *     right rail opening / closing) re-render only this subtree
 *     and never touch the wordmark, search bar or panel toggles;
 *   - the top bar's scroll-driven `showTopPanel` flips cascade
 *     through `<Slide>`'s box wrapper but stop here thanks to the
 *     `React.memo` wrap on the export.
 *
 * Notifications used to live on a dedicated bell here; they are now
 * reached from the user menu (`UserMenu` -> Notifications), so this
 * cluster only owns the avatar menu anchor.
 */
const TopBarRightClusterImpl: React.FC = () => {
  const { rightPanel } = useLayout();
  const { data: user } = useUser();
  const { isPublic } = usePublicRouteReady({ timeoutMs: 0 });
  // Anonymous viewers on a public share: no Discord profile, so the
  // avatar falls back to the generated public handle's initials.
  const isAnonymousPublic = isPublic && !user;

  // Local anchor: opening / closing the user menu only re-renders
  // this subtree.
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );

  // Slots render whenever a right rail is mounted -- the toolbar
  // is wired into the top bar at all times, independent of whether
  // the rail is open or closed. Routes without a right rail
  // (home, settings, ...) don't contribute anything; the rail's
  // own toolbar mount has been removed (the rail only hosts the
  // content panels now), so there is no double-up risk. The
  // registry itself lives in `useTopBarStore`.
  //
  // Some routes use the top bar for page controls even though they
  // own no right rail (e.g. the shelf settings width toggle). Those
  // still register a slot, so show slots whenever either the rail is
  // mounted or a contributor registered one.
  const slotEntries = useTopBarStore((s) => s.slots);
  const showSlots = rightPanel !== null || Object.keys(slotEntries).length > 0;
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
        <IconButton
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          size="small"
          sx={{
            p: 0.25,
            ml: sortedSlots.length > 0 ? 1 : 0,
            borderRadius: "50%",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          {isAnonymousPublic ? (
            <PublicUserAvatar size={36} fontSize={14} />
          ) : (
            <Avatar
              sx={{ width: 36, height: 36 }}
              src={user ? user.getAvatarUrl() : undefined}
              alt={user ? user.username : ""}
            />
          )}
        </IconButton>
      </Stack>

      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 300,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
            },
          },
        }}
      >
        <UserMenu onRequestClose={() => setUserMenuAnchor(null)} />
      </Menu>
    </>
  );
};

/**
 * Memoised so a re-render of `:class:`DesktopTopBar` for an unrelated
 * reason (e.g. `showTopPanel` flipping on scroll) doesn't push a
 * re-render through the cluster's user-avatar re-read or its anchor
 * state. The cluster has no props, so the shallow comparison is exact.
 */
export const TopBarRightCluster = React.memo(TopBarRightClusterImpl);
