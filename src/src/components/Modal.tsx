import React, {
  createContext,
  useContext,
  useEffect,
  useId,
} from "react";
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
import type { SxProps, Theme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../zustand/useThemeStore";
import { MODAL_BACKDROP_BLUR, MODAL_BACKDROP_COLOR } from "../statics";

/**
 * Compound modal built from composable parts:
 *
 *   <Modal open onClose maxWidth="md">
 *     <Modal.Header icon={<Icon />} title="Title" subtitle="Subtitle" />
 *     <Modal.Body>…</Modal.Body>
 *     <Modal.Footer>
 *       <Button>Cancel</Button>
 *       <Button variant="contained">Confirm</Button>
 *     </Modal.Footer>
 *   </Modal>
 *
 * Each part renders the matching MUI slot (`DialogTitle`, `DialogContent`,
 * `DialogActions`) with the project's shared styling, so call sites only
 * describe content instead of threading config props through a shell.
 *
 * `Modal.Header` / `Modal.Body` / `Modal.Footer` must be rendered as
 * descendants of `<Modal>`; they read `onClose` and the title id from
 * context.
 */

interface ModalContextValue {
  /** Fired by the header X, backdrop, and Escape. */
  onClose: () => void;
  /** Id applied to the header title so `Dialog` can label itself. */
  labelledBy: string;
}

const ModalContext = createContext<ModalContextValue | null>(null);

const useModalContext = (): ModalContextValue => {
  const context = useContext(ModalContext);
  if (context === null) {
    throw new Error("Modal.Header/Body/Footer must be used inside <Modal>");
  }
  return context;
};

export interface ModalProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Fired on X / backdrop / Escape. */
  onClose: () => void;
  /** Modal parts: `Modal.Header`, `Modal.Body`, `Modal.Footer`. */
  children: React.ReactNode;
  /** Max width of the dialog; mirrors MUI's `Dialog` `maxWidth` prop. */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Suppress the browser context menu inside the dialog. */
  disableContextMenu?: boolean;
  /** Optional `aria-labelledby` id; auto-derived by `Modal.Header`. */
  ariaLabelledBy?: string;
}

/**
 * Root shell. Owns the MUI `Dialog`, the blurred backdrop, and the
 * bordered/shadowed paper. Provides `onClose` + the title id to the
 * header via context.
 */
const ModalRoot: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  maxWidth = "md",
  disableContextMenu = false,
  ariaLabelledBy,
}) => {
  const { theme } = useThemeStore();
  const generatedId = useId();
  const labelledBy = ariaLabelledBy ?? `modal-title-${generatedId}`;

  // Some dialogs own their context menu entirely. A capture-phase
  // document listener is more reliable than a React handler here
  // because the global RightClickMenuHost also listens on document.
  useEffect(() => {
    if (!disableContextMenu || !open) return;
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".MuiModal-root")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", handleContextMenu, true);
    return () =>
      document.removeEventListener("contextmenu", handleContextMenu, true);
  }, [disableContextMenu, open]);

  return (
    <ModalContext.Provider value={{ onClose, labelledBy }}>
      <Dialog
        open={open}
        onClose={onClose}
        onContextMenu={
          disableContextMenu ? (event) => event.preventDefault() : undefined
        }
        fullWidth
        maxWidth={maxWidth}
        aria-labelledby={labelledBy}
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: MODAL_BACKDROP_BLUR,
              backgroundColor: MODAL_BACKDROP_COLOR,
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
        {children}
      </Dialog>
    </ModalContext.Provider>
  );
};

export interface ModalHeaderProps {
  /** MUI icon rendered inside the top-left chip. */
  icon?: React.ReactNode;
  /** Title shown in the header next to the icon. */
  title?: React.ReactNode;
  /** Smaller line below the title. Optional. */
  subtitle?: React.ReactNode;
  /** Show the top-right X. Defaults to true. */
  showCloseButton?: boolean;
  /** Override the close handler (defaults to the root `onClose`). */
  onClose?: () => void;
  /** Escape hatch: renders in place of the icon/title block. */
  children?: React.ReactNode;
}

/** Header row: circular icon chip, title/subtitle, and optional X. */
const ModalHeader: React.FC<ModalHeaderProps> = ({
  icon,
  title,
  subtitle,
  showCloseButton = true,
  onClose,
  children,
}) => {
  const { theme } = useThemeStore();
  const { onClose: contextClose, labelledBy } = useModalContext();
  const handleClose = onClose ?? contextClose;

  return (
    <>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2,
          py: 1,
          backgroundColor: theme.elevate(theme.palette.background.default, 14),
        }}
        id={labelledBy}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {icon && (
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                // increase size by 1.5
                transform: "scale(1.5)",
                borderRadius: "999px",
                color: theme.palette.primary.main,
              }}
            >
              {icon}
            </Box>
          )}
          {children ?? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              {title && <Typography variant="h6">{title}</Typography>}
              {subtitle && (
                <Typography
                  variant="body1"
                  sx={{ color: theme.palette.text.secondary }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {showCloseButton && (
          <Tooltip title="Close">
            <IconButton
              onClick={handleClose}
              size="small"
              aria-label="Close dialog"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </DialogTitle>

      <Divider />
    </>
  );
};

export interface ModalBodyProps {
  children: React.ReactNode;
  /** Override default minHeight of the content area. */
  minHeight?: string | number;
  sx?: SxProps<Theme>;
}

/** Scrollable content area with the modal's default background. */
const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  minHeight = "32vh",
  sx,
}) => {
  const { theme } = useThemeStore();

  return (
    <DialogContent
      sx={[
        {
          backgroundColor: theme.elevate(theme.palette.background.default, 1),
          minHeight,
          px: 2.5,
          py: 2.5,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </DialogContent>
  );
};

export interface ModalFooterProps {
  children: React.ReactNode;
  /** Horizontal alignment of the actions. Defaults to `flex-end`. */
  align?: "flex-start" | "center" | "flex-end" | "space-between";
}

/** Footer actions row with the shared divider + background. */
const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  align = "flex-end",
}) => {
  const { theme } = useThemeStore();

  return (
    <>
      <Divider />
      <DialogActions
        sx={{
          px: 2.5,
          py: 1.5,
          backgroundColor: theme.elevate(theme.palette.background.default, 1),
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ width: "100%", justifyContent: align }}
        >
          {children}
        </Stack>
      </DialogActions>
    </>
  );
};

type ModalComponent = React.FC<ModalProps> & {
  Header: React.FC<ModalHeaderProps>;
  Body: React.FC<ModalBodyProps>;
  Footer: React.FC<ModalFooterProps>;
};

/**
 * Compound modal. Compose `Modal.Header`, `Modal.Body`, and `Modal.Footer`
 * as children instead of passing config props to a single shell.
 */
export const Modal = ModalRoot as ModalComponent;
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
