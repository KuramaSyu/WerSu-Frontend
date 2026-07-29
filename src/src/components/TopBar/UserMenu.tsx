import React from "react";
import {
  Avatar,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import Logout from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUser } from "../../api/queries/useUser";
import { M1, M2 } from "../../statics";
import { Pages } from "./Pages";

export interface UserMenuProps {
  /** Fired after the user picks a row; parent closes the surrounding Menu. */
  onRequestClose: () => void;
}

/**
 * Avatar `Menu` body: profile header, Settings, Logout.
 * Notifications used to live here; moved to a dedicated bell button.
 */
export const UserMenu: React.FC<UserMenuProps> = ({ onRequestClose }) => {
  const { theme } = useThemeStore();
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Clear the query cache so the previous user's data doesn't flash
  // on the next session.
  const handleLogout = () => {
    queryClient.clear();
    onRequestClose();
  };

  const handleOpenSettings = () => {
    navigate(Pages.SETTINGS);
    onRequestClose();
  };

  return (
    // minWidth hints the Menu past the longest text so the profile
    // header doesn't squeeze.
    <Stack sx={{ minWidth: 240 }}>
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

      <MenuItem
        onClick={handleOpenSettings}
        sx={{ "&:hover": { backgroundColor: theme.palette.action.hover } }}
      >
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Settings" />
      </MenuItem>
      <MenuItem
        onClick={handleLogout}
        sx={{ "&:hover": { backgroundColor: theme.palette.action.hover } }}
      >
        <ListItemIcon>
          <Logout fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </MenuItem>
    </Stack>
  );
};

export default UserMenu;
