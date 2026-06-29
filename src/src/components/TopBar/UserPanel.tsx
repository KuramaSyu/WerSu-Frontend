import React from "react";
import {
  alpha,
  Avatar,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import Logout from "@mui/icons-material/Logout";
import { useQueryClient } from "@tanstack/react-query";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { M1, M2, M3 } from "../../statics";
import { NotificationsPanel } from "./NotificationsPanel";

export interface UserPanelProps {
  /**
   * Called when the user touches the mobile-only drag handle at the
   * top of the drawer. The drawer itself owns the open/close state,
   * so it passes this in rather than letting the panel talk to the
   * store directly.
   */
  onRequestClose: () => void;
}

/**
 * Body of the right-side user drawer. Composed of:
 *
 *   1. Profile header (avatar + username)
 *   2. Notification log (delegated to `NotificationsPanel`)
 *   3. Logout button
 *
 * The Streak section that used to live here was removed entirely —
 * its data flow wasn't implemented and the icon (`LocalFireDepartment`)
 * is now unused so it can be dropped from imports as well.
 */
export const UserPanel: React.FC<UserPanelProps> = ({ onRequestClose }) => {
  const { theme } = useThemeStore();
  const { isMobile } = useBreakpoint();
  const { data: user } = useUser();
  const queryClient = useQueryClient();

  /**
   * Logout clears the React Query cache so user-bound queries don't
   * briefly show the previous user's data on the next session, then
   * closes the drawer. The `queryClient` handle is captured at the
   * top of the component so the React Hooks linter sees the call in
   * a stable position.
   */
  const handleLogout = () => {
    queryClient.clear();
    onRequestClose();
  };

  return (
    // The width is applied to the `SwipeableDrawer`'s `Paper` slot
    // (see `TopBar.tsx`), not to an inner wrapper box. Sizing the
    // inner box used to leave the drawer's white background looking
    // narrower than 3/8 because the `Paper` MUI renders around the
    // content keeps its own intrinsic width.
    <>
      {isMobile && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            py: M1,
            cursor: "pointer",
          }}
          onClick={onRequestClose}
        >
          <Box
            sx={{
              width: 40,
              height: 4,
              backgroundColor: alpha(theme.palette.text.primary, 0.3),
              borderRadius: 2,
              transition: "background-color 0.2s ease",
              "&:hover": {
                backgroundColor: alpha(theme.palette.text.primary, 0.5),
              },
            }}
          />
        </Box>
      )}

      {/* Profile header */}
      <Box sx={{ p: M3, textAlign: "center" }}>
        <Avatar
          sx={{ width: 80, height: 80, mx: "auto", mb: M2 }}
          src={user?.getAvatarUrl()}
          alt={user?.username ?? ""}
        />
        <Typography variant="h6">{user?.username ?? "Guest"}</Typography>
      </Box>

      <Divider />

      <NotificationsPanel />

      <Divider />

      <List>
        <ListItemButton onClick={handleLogout}>
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </List>
    </>
  );
};

export default UserPanel;
