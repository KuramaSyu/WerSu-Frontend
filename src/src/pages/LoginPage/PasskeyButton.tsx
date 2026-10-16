// Passkey login button. Rectangular outlined affordance matching the
// auth card layout. Disabled on browsers without WebAuthn so the
// actionable state stays honest.

import React, { useMemo } from "react";
import { ThemeProvider, Button, Stack } from "@mui/material";
import { defaultTheme } from "../../theme/themes";
import {
  usePasskeyLogin,
  isWebAuthnSupported,
} from "../../hooks/usePasskeyCeremony";

export const PasskeyButton: React.FC = () => {
  const login = usePasskeyLogin();
  const supported = useMemo(() => isWebAuthnSupported(), []);
  const theme = defaultTheme;

  return (
    <ThemeProvider theme={theme}>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => login.mutate()}
        disabled={!supported || login.isPending}
        fullWidth
        aria-label="Login with passkey"
        sx={{
          py: 1.25,
          borderRadius: 1.5,
          color: theme.palette.text.primary,
        }}
        startIcon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <path
              d="M21 10h-8.35A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H13l2 2 2-2 2 2 4-4.04L21 10zM7 15c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"
              fill={theme.palette.text.primary}
            />
          </svg>
        }
      >
        <Stack
          direction="row"
          sx={{ width: "100%", alignItems: "center", justifyContent: "center" }}
          spacing={1}
        >
          <span>Passkey</span>
        </Stack>
      </Button>
    </ThemeProvider>
  );
};
