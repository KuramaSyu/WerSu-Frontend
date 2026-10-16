// Settings: Security section. Change password, profile patch, linked methods.

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import KeyIcon from "@mui/icons-material/VpnKey";
import PersonIcon from "@mui/icons-material/Person";
import { useQueryClient } from "@tanstack/react-query";
import { getUserManagementApi } from "../../api/UserManagementApi";
import { useUser } from "../../api/queries/useUser";
import { useUserStore } from "../../zustand/userStore";
import { WersuUserImpl } from "../../components/DiscordLogin";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import {
  isWebAuthnSupported,
  usePasskeyLink,
} from "../../hooks/usePasskeyCeremony";
import type { ChangePasswordRequest } from "../../api/models/userManagement";
import {
  LINKED_PROVIDER_KIND,
  isLinkedPasskeyActive,
} from "../../api/models/linkedProviders";
import {
  linkedProvidersKeys,
  useLinkedCredentials,
} from "../../api/queries/linkedProvidersQueries";

type CardState = "idle" | "pending" | "error" | "success";

interface ChangePasswordFormState {
  status: CardState;
  message?: string;
}

interface PatchFieldState {
  status: CardState;
  message?: string;
}

/** Card 1: POST /api/auth/password/change */
function ChangePasswordCard(): React.ReactElement {
  // Whether the user already has a password is read from
  // GET /api/auth/me/credentials; while the response is in flight we
  // assume they do (legacy default) so existing users don't see the
  // current field flash and disappear.
  const credentialsQuery = useLinkedCredentials();
  const hasPassword = credentialsQuery.isSuccess
    ? credentialsQuery.data.credentials.some(
        (c) => c.kind === LINKED_PROVIDER_KIND.PASSWORD,
      )
    : true;
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<ChangePasswordFormState>({
    status: "idle",
  });
  const { setMessage } = useInfoStore();

  const submit = async () => {
    if (state.status === "pending") return;
    if (next.length < 8) {
      setState({
        status: "error",
        message: "New password must be at least 8 characters.",
      });
      return;
    }
    if (next !== confirm) {
      setState({ status: "error", message: "New passwords do not match." });
      return;
    }
    setState({ status: "pending" });
    const payload: ChangePasswordRequest = { new_password: next };
    if (hasPassword) payload.current = current;
    try {
      await getUserManagementApi().changePassword(payload);
      setCurrent("");
      setNext("");
      setConfirm("");
      setState({ status: "success", message: "Password updated." });
      setMessage(new SnackbarUpdateImpl("Password changed", "success"));
      // Refetch the credentials so the linked-methods card flips
      // "Password" from "Not set" to "Set" immediately.
      queryClient.invalidateQueries({
        queryKey: linkedProvidersKeys.credentials(),
      });
    } catch (e) {
      const status =
        e instanceof Error && "status" in e && typeof e.status === "number"
          ? (e as { status: number }).status
          : 0;
      const msg =
        status === 401
          ? "Current password is wrong."
          : status === 400
            ? "New password is invalid."
            : e instanceof Error
              ? e.message
              : "Password change failed.";
      setState({ status: "error", message: msg });
    }
  };

  const disabled = state.status === "pending";
  const canSubmit =
    !disabled &&
    next.length > 0 &&
    confirm.length > 0 &&
    (hasPassword ? current.length > 0 : true);

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardHeader
        avatar={<KeyIcon color="primary" />}
        title="Change password"
        subheader={
          hasPassword
            ? "Enter your current password and a new one."
            : "No password is set on this account yet. Pick one below."
        }
      />
      <CardContent>
        <Stack spacing={2}>
          {hasPassword && (
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={disabled}
              fullWidth
            />
          )}
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={disabled}
            fullWidth
            helperText="At least 8 characters."
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={disabled}
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button
              variant="contained"
              onClick={submit}
              disabled={!canSubmit}
              startIcon={
                state.status === "pending" ? (
                  <CircularProgress size={16} />
                ) : null
              }
            >
              {hasPassword ? "Update password" : "Set password"}
            </Button>
            {state.status === "success" && (
              <Typography variant="body2" color="success.main">
                {state.message}
              </Typography>
            )}
          </Stack>
          {state.status === "error" && (
            <Alert severity="error">{state.message}</Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Card 2: PATCH /api/users/{id}, one field at a time. */
function ProfileFieldsCard(): React.ReactElement {
  const userQuery = useUser();
  const user = userQuery.data;
  const setUser = useUserStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const { setMessage } = useInfoStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [usernameState, setUsernameState] = useState<PatchFieldState>({
    status: "idle",
  });
  const [emailState, setEmailState] = useState<PatchFieldState>({
    status: "idle",
  });

  const submitPatch = async (
    field: "username" | "email",
    value: string,
    setState: (next: PatchFieldState) => void,
  ) => {
    if (!user) return;
    if (setState === undefined) return;
    if (value.trim() === "") {
      setState({ status: "error", message: "Value cannot be empty." });
      return;
    }
    setState({ status: "pending" });
    try {
      const updated = await getUserManagementApi().patchUser(user.id, {
        [field]: value,
      });
      // Fall back to the current user's values for fields the backend
      // returned as null or undefined (avatar_url, email, etc.).
      setUser(
        new WersuUserImpl({
          id: updated.id,
          username: updated.username,
          avatar_url: updated.avatar_url ?? user.avatar_url,
          email: updated.email ?? user.email,
          email_verified_at:
            updated.email_verified_at ?? user.email_verified_at,
          is_active: updated.is_active,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setState({ status: "success", message: "Saved." });
      setMessage(new SnackbarUpdateImpl(`${field} updated`, "success"));
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Update failed.",
      });
    }
  };

  if (!user) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader
          avatar={<PersonIcon color="primary" />}
          title="Profile"
          subheader="Loading your profile..."
        />
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardHeader
        avatar={<PersonIcon color="primary" />}
        title="Profile"
        subheader="Update your username or email. Each field is saved independently."
      />
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="Username"
              value={username.length > 0 ? username : user.username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={usernameState.status === "pending"}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() => {
                if (username.trim().length === 0) {
                  setUsernameState({
                    status: "error",
                    message: "Value cannot be empty.",
                  });
                  return;
                }
                void submitPatch("username", username, setUsernameState);
              }}
              disabled={usernameState.status === "pending"}
            >
              Save
            </Button>
          </Stack>
          {usernameState.status === "error" && (
            <Alert severity="error">{usernameState.message}</Alert>
          )}
          {usernameState.status === "success" && (
            <Typography variant="caption" color="success.main">
              {usernameState.message}
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="Email"
              type="email"
              value={email.length > 0 ? email : user.email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailState.status === "pending"}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() => {
                if (email.trim().length === 0) {
                  setEmailState({
                    status: "error",
                    message: "Value cannot be empty.",
                  });
                  return;
                }
                void submitPatch("email", email, setEmailState);
              }}
              disabled={emailState.status === "pending"}
            >
              Save
            </Button>
          </Stack>
          {emailState.status === "error" && (
            <Alert severity="error">{emailState.message}</Alert>
          )}
          {emailState.status === "success" && (
            <Typography variant="caption" color="success.main">
              {emailState.message}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Match the backend's "passkey support is not configured" error.
 * The Go controller returns this exact prefix when WEBAUTHN_RP_ID
 * (or any sibling WebAuthn env var) is unset. Treated case-insensitively
 * so the same UX survives minor wording changes upstream.
 */
const PASSKEY_UNCONFIGURED_PREFIX = "passkey support is not configured";

const isPasskeyUnconfigured = (message: string): boolean =>
  message.toLowerCase().startsWith(PASSKEY_UNCONFIGURED_PREFIX);

/** Card 3: read-only summary of linked auth providers + passkey linking. */
function LinkedMethodsCard(): React.ReactElement {
  const userQuery = useUser();
  const user = userQuery.data;
  const credentialsQuery = useLinkedCredentials();
  const credentials = credentialsQuery.data;
  const credentialsKnown = credentialsQuery.isSuccess;
  const queryClient = useQueryClient();
  const linkPasskey = usePasskeyLink();
  const supported = useMemo(() => isWebAuthnSupported(), []);
  const { setMessage } = useInfoStore();
  const [linkStatus, setLinkStatus] = useState<CardState>("idle");
  const [linkError, setLinkError] = useState<string | undefined>();
  const [serverUnsupported, setServerUnsupported] = useState(false);

  const startLink = () => {
    if (!supported || linkPasskey.isPending || serverUnsupported) return;
    setLinkStatus("pending");
    setLinkError(undefined);
    linkPasskey.mutate(
      {},
      {
        onSuccess: () => {
          setLinkStatus("success");
          setMessage(new SnackbarUpdateImpl("Passkey added", "success"));
          // Refetch credentials so the passkey row reflects the new one.
          queryClient.invalidateQueries({
            queryKey: linkedProvidersKeys.credentials(),
          });
        },
        onError: (e) => {
          const raw = e instanceof Error ? e.message : "Failed to add passkey.";
          if (isPasskeyUnconfigured(raw)) {
            setServerUnsupported(true);
            setLinkError(
              "Passkeys aren't configured on this server. Set WEBAUTHN_RP_ID on the backend, then restart it.",
            );
          } else {
            setLinkError(raw);
          }
          setLinkStatus("error");
        },
      },
    );
  };

  if (!user) {
    return (
      <Card variant="outlined">
        <CardHeader
          avatar={<LockIcon color="primary" />}
          title="Linked sign-in methods"
          subheader="Loading..."
        />
      </Card>
    );
  }
  // All three lines are derived from GET /api/auth/me/credentials.
  // Until the response lands we render a neutral "Loading..." so the
  // UI doesn't claim "Not linked" for a Discord-only account on the
  // first paint.
  const discordLinked = credentialsKnown
    ? credentials!.credentials.some(
        (c) => c.kind === LINKED_PROVIDER_KIND.DISCORD,
      )
    : null;
  const passwordSet = credentialsKnown
    ? credentials!.credentials.some(
        (c) => c.kind === LINKED_PROVIDER_KIND.PASSWORD,
      )
    : null;
  const activePasskeyCount = credentialsKnown
    ? (credentials!.passkeys ?? []).filter(isLinkedPasskeyActive).length
    : null;
  const linking = linkStatus === "pending" || linkPasskey.isPending;
  const disabled = !supported || linking || serverUnsupported;
  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<LockIcon color="primary" />}
        title="Linked sign-in methods"
        subheader="Methods you can use to sign in to your account."
      />
      <CardContent>
        <Stack spacing={1}>
          <Box>
            <Typography variant="subtitle2">Discord</Typography>
            <Typography variant="body2" color="text.secondary">
              {discordLinked === null
                ? "Loading..."
                : discordLinked
                  ? "Linked."
                  : "Not linked."}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2">Password</Typography>
            <Typography variant="body2" color="text.secondary">
              {passwordSet === null
                ? "Loading..."
                : passwordSet
                  ? "Set."
                  : "Not set."}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2">Passkey</Typography>
            <Typography variant="body2" color="text.secondary">
              {activePasskeyCount === null
                ? "Loading..."
                : activePasskeyCount === 0
                  ? "None registered."
                  : `${activePasskeyCount} registered.`}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 1, alignItems: "center" }}
            >
              <Button
                variant="contained"
                onClick={startLink}
                disabled={disabled}
                data-testid="add-passkey"
                startIcon={linking ? <CircularProgress size={16} /> : null}
              >
                Add passkey
              </Button>
              {!supported && (
                <Typography variant="caption" color="text.secondary">
                  WebAuthn isn't available in this browser.
                </Typography>
              )}
              {supported && serverUnsupported && (
                <Typography variant="caption" color="text.secondary">
                  Not available on this server.
                </Typography>
              )}
              {linkStatus === "success" && (
                <Typography variant="caption" color="success.main">
                  Passkey added.
                </Typography>
              )}
            </Stack>
            {linkStatus === "error" && linkError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {linkError}
              </Alert>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export const SecuritySection: React.FC = () => {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2 }}>
        Manage how you sign in and how your account is identified.
      </Typography>
      <ChangePasswordCard />
      <ProfileFieldsCard />
      <LinkedMethodsCard />
    </Box>
  );
};
