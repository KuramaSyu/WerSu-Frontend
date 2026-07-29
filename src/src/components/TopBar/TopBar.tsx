import React, { useState } from "react";
import { Menu, Popover } from "@mui/material";
import { useLayout } from "../../LayoutProvider";
import { TopBarAppBar } from "./TopBarAppBar";
import { UserMenu } from "./UserMenu";
import { NotificationsPanel } from "./NotificationsPanel";
import { ServiceFailureDialog } from "./ServiceFailureDialog";
import { useTopBarScrollVisibility } from "./useTopBarScrollVisibility";
import { useServiceReachability } from "./useServiceReachability";

export interface TopBarProps {
  scrollContainer?: HTMLElement | null;
}

/**
 * Application top bar. Owns scroll-driven show/hide, the avatar
 * `Menu` anchor, the notifications `Popover` anchor, and the
 * service-failure modal. Presentational pieces live in sibling
 * files; this just wires state.
 */
const TopBar: React.FC<TopBarProps> = ({ scrollContainer }) => {
  const { setShowTopBar: setShowBar } = useLayout();
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [notificationsAnchor, setNotificationsAnchor] =
    useState<HTMLElement | null>(null);
  const reachability = useServiceReachability();

  useTopBarScrollVisibility(scrollContainer, setShowBar);

  return (
    <>
      {/* Menu + Popover are siblings of the slide target on purpose:
          their Modal portals are position: fixed and would slip out
          of the slide target's transform otherwise. */}
      <TopBarAppBar
        onOpenUserMenu={(el) => setUserMenuAnchor(el)}
        onOpenNotifications={(el) => setNotificationsAnchor(el)}
        servicesReachable={reachability.servicesReachable}
      />
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
          // Cap width so the popover fits next to the compact toolbar.
          paper: { sx: { width: 420, maxWidth: "calc(100vw - 2rem)" } },
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

export default TopBar;
