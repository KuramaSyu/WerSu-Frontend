/*
 * Passkey login control.
 *
 * Minimal surface: a `KeyboardShortcut` chip sits above the button so
 * the keyboard affordance is the only piece of text on the page. The
 * button itself is icon-only (so the affordance doesn't compete with
 * the Discord button above it). Errors are intentionally silent -
 * the actionable state is the disabled button on unsupported browsers.
 */

import React, { useMemo } from "react";
import { ThemeProvider, Button, Stack } from "@mui/material";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import { defaultTheme } from "../../theme/themes";
import {
  usePasskeyLogin,
  isWebAuthnSupported,
} from "../../hooks/usePasskeyCeremony";

export const PasskeyLogin: React.FC = () => {
  const login = usePasskeyLogin();
  const supported = useMemo(() => isWebAuthnSupported(), []);
  const theme = defaultTheme;

  return (
    <ThemeProvider theme={theme}>
      <Stack sx={{ alignItems: "center", mt: 2 }} spacing={1}>
        <KeyboardShortcut shortcut="ctrl+shift+p" />
        <Button
          variant="outlined"
          color="primary"
          onClick={() => login.mutate()}
          disabled={!supported || login.isPending}
          aria-label="Login with passkey"
          sx={{
            width: 56,
            height: 56,
            minWidth: 56,
            borderRadius: "50%",
            color: theme.palette.text.primary,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="28"
            height="28"
            aria-hidden="true"
          >
            <path
              d="M21 10h-8.35A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H13l2 2 2-2 2 2 4-4.04L21 10zM7 15c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"
              fill={theme.palette.text.primary}
            />
          </svg>
        </Button>
      </Stack>
    </ThemeProvider>
  );
};
