import { Box, Fade } from "@mui/material";

export interface MobileDrawerBackdropProps {
  /** Whether the drawer is open (and the scrim should show). */
  open: boolean;
  /** Called when the scrim is tapped. */
  onClose: () => void;
}

/**
 * Dim, full-viewport scrim rendered behind a mobile side-rail drawer.
 * Tapping it closes the drawer. Sits just below the drawer's z-index
 * (the drawer is `appBar + 1`, this is `appBar`).
 */
export const MobileDrawerBackdrop: React.FC<MobileDrawerBackdropProps> = ({
  open,
  onClose,
}) => (
  <Fade in={open} timeout={200} unmountOnExit>
    <Box
      aria-hidden
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: (t) => t.zIndex.appBar,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
      }}
    />
  </Fade>
);
