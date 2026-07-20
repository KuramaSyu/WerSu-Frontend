import React, { useCallback } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  MicroInteractionButton,
  type MicroInteractionButtonProps,
} from "./MicroInteractionButton";
import useInfoStore, {
  copyToClipboard,
  SnackbarUpdateImpl,
} from "../zustand/InfoStore";

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
  onCopy?: (text: string) => Promise<boolean> | boolean;
  showToast?: boolean;
  successMessage?: string;
  failureMessage?: string;
  icon?: React.ReactNode;
  microInteraction?: React.ReactNode;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text = "",
  onCopy,
  showToast = true,
  successMessage = "Copied to clipboard",
  failureMessage = "Copy failed",
  icon,
  microInteraction,
  microDurationMs = Math.PI * 1000,
  disabled,
  ...buttonProps
}) => {
  //   const setMessage = useInfoStore((s) => s.setMessage);

  const handleTrigger = useCallback(() => {
    const run = async () => {
      const ok = onCopy ? await onCopy(text) : await copyToClipboard(text);
      if (!showToast) return;
      //   setMessage(
      //     new SnackbarUpdateImpl(
      //       ok ? successMessage : failureMessage,
      //       ok ? "success" : "error",
      //     ),
      //   );
    };
    void run();
  }, [onCopy, text, showToast, successMessage, failureMessage]);

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
