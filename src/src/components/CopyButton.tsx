import React, { useCallback } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  MicroInteractionButton,
  type MicroInteractionButtonProps,
} from "./MicroInteractionButton";
import { copyToClipboard } from "../zustand/InfoStore";

/**
 * Copy-to-clipboard button used throughout the app.
 *
 * ```tsx
 * <CopyButton text={shareUrl} aria-label="copy share url" size="small" />
 * ```
 */
export interface CopyButtonProps extends Omit<
  MicroInteractionButtonProps,
  "onTrigger" | "icon" | "microInteraction"
> {
  text?: string;
  /**
   * Custom copy handler — takes precedence over `copyFunction`.
   * Use this when the caller wants to intercept the copy (e.g. with
   * additional side-effects).
   */
  onCopy?: (text: string) => Promise<boolean> | boolean;
  /**
   * Test seam: inject the actual copy implementation. Defaults to
   * `copyToClipboard` from the InfoStore. Tests should override this
   * to avoid touching the real clipboard and to assert call args.
   */
  copyFunction?: (text: string) => Promise<boolean> | boolean;
  icon?: React.ReactNode;
  microInteraction?: React.ReactNode;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text = "",
  onCopy,
  copyFunction = copyToClipboard,
  icon,
  microInteraction,
  microDurationMs = Math.PI * 1000,
  disabled,
  ...buttonProps
}) => {
  const handleTrigger = useCallback(() => {
    const run = async () => {
      if (onCopy) {
        await onCopy(text);
      } else {
        await copyFunction(text);
      }
    };
    void run();
  }, [onCopy, copyFunction, text]);

  return (
    <MicroInteractionButton
      {...buttonProps}
      disabled={disabled ?? (!onCopy && text === "")}
      onTrigger={handleTrigger}
      icon={icon ?? <ContentCopyIcon fontSize="small" />}
      microInteraction={
        microInteraction ?? <CheckCircleIcon fontSize="small" color="success" />
      }
      microDurationMs={microDurationMs}
    />
  );
};

export default CopyButton;
