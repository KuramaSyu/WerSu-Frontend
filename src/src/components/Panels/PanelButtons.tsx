import { Button, Stack, type ButtonProps } from "@mui/material";

interface PanelButtonsContainerProps {
  children: React.ReactNode;
}

/**
 * Container for a vertical stack of panel buttons.
 *
 * Use `PanelButtons.Primary` and `PanelButtons.Secondary` as children to
 * keep a consistent visual rhythm between primary actions (filled) and
 * secondary actions (outlined).
 */
const PanelButtonsContainer: React.FC<PanelButtonsContainerProps> = ({
  children,
}) => {
  return (
    <Stack spacing={1} sx={{ width: "100%" }}>
      {children}
    </Stack>
  );
};

interface PanelButtonProps extends Omit<ButtonProps, "variant"> {
  startIcon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Primary action button - filled (`variant="contained"`).
 */
const Primary: React.FC<PanelButtonProps> = ({ children, ...rest }) => {
  return (
    <Button variant="contained" fullWidth {...rest}>
      {children}
    </Button>
  );
};

/**
 * Secondary action button - outlined (`variant="outlined"`).
 */
const Secondary: React.FC<PanelButtonProps> = ({ children, ...rest }) => {
  return (
    <Button variant="outlined" fullWidth {...rest}>
      {children}
    </Button>
  );
};

/**
 * Compound component for the vertical stack of panel action buttons.
 *
 * Usage:
 * ```tsx
 * <PanelButtons>
 *   <PanelButtons.Secondary startIcon={<BackIcon />} onClick={...}>
 *     Back
 *   </PanelButtons.Secondary>
 *   <PanelButtons.Primary startIcon={<CreateIcon />} onClick={...}>
 *     Create note
 *   </PanelButtons.Primary>
 * </PanelButtons>
 * ```
 */
export const PanelButtons = Object.assign(PanelButtonsContainer, {
  Primary,
  Secondary,
});