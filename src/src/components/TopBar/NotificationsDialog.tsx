import React from "react";
import { Dialog, DialogContent } from "@mui/material";
import { NotificationsPanel } from "./NotificationsPanel";
import { useNotificationsStore } from "../../zustand/useNotificationsStore";

/**
 * Always-mounted host for the notifications panel.
 *
 * Notifications moved off the top bar / mobile bottom bar and into
 * the user menu, so the trigger (a `MenuItem` inside `UserMenu`) and
 * the panel can't share a React tree: the menu unmounts on close.
 * This dialog lives in the `AppShell` and reads the open state from
 * `useNotificationsStore`, keeping the panel alive across menu
 * dismissal.
 */
export const NotificationsDialog: React.FC = () => {
  const isDialogOpen = useNotificationsStore((s) => s.isDialogOpen);
  const setIsDialogOpen = useNotificationsStore((s) => s.setIsDialogOpen);

  return (
    <Dialog
      open={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <NotificationsPanel onClose={() => setIsDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default NotificationsDialog;
