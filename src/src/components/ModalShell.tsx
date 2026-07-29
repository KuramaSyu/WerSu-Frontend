import React from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../zustand/useThemeStore";

export interface ModalShellProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Fired on X / backdrop / Escape. */
  onClose: () => void;
  /** MUI icon rendered inside the top-left chip. */
  icon: React.ReactNode;
  /** Title shown in the header next to the icon. */
  title: string;
  /** Smaller line below the title. Optional. */
  subtitle?: string;
  /** Body content rendered inside `DialogContent`. */
  children: React.ReactNode;
  /** Footer content rendered inside `DialogActions`. */
  actions?: React.ReactNode;
  /** Optional `aria-labelledby` id; auto-derived from title if absent. */
  ariaLabelledBy?: string;
  /** When true, renders `Stack direction="row"` actions at the bottom. */
  /** Max width of the dialog; mirrors MUI's `Dialog` `maxWidth` prop. */
  maxWidth?: "xs" | "sm" | "md" | "lg";
  /** Override default minHeight of the content area. */
  minHeight?: string | number;
}

/**
 * Shared shell for the project's modals. Centralises:
 *   - blurred backdrop + rounded, bordered paper with shadow
 *   - header row with circular icon chip + title/subtitle
 *   - top-right X that triggers `onClose`
 *   - divider + `background.default` body + `DialogActions` footer
 *
 * Used by `CreateNote`, `CreateDirectory`, `ServiceFailureDialog`.
 * Per-modal copy + form fields live in the children + actions slots.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  icon,
  title,
  subtitle,
  children,
  actions,
  ariaLabelledBy,
  maxWidth = "md",
  minHeight = "32vh",
}) => {
  const { theme } = useThemeStore();
  const labelledBy =
    ariaLabelledBy ?? `modal-shell-title-${title.replace(/\s+/g, "-")}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
          },
        },
        paper: {
          sx: {
            borderRadius: 4,
            border: `1px solid ${theme.palette.divider}`,
            backgroundImage: "none",
            overflow: "hidden",
            boxShadow: theme.shadows[10],
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2.5,
          py: 2,
          backgroundColor: theme.palette.background.paper,
        }}
        id={labelledBy}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 32,
              height: 32,
              borderRadius: "999px",
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.primary.main,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography
                variant="body1"
                sx={{
                  color: theme.palette.text.secondary,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        <Tooltip title="Close">
          <IconButton onClick={onClose} size="small" aria-label="Close dialog">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <Divider />

      <DialogContent
        sx={{
          backgroundColor: theme.palette.background.default,
          minHeight,
          px: 2.5,
          py: 2.5,
        }}
      >
        {children}
      </DialogContent>

      {actions && (
        <>
          <Divider />
          <DialogActions
            sx={{
              px: 2.5,
              py: 1.5,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ width: "100%", justifyContent: "flex-end" }}
            >
              {actions}
            </Stack>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default ModalShell;
