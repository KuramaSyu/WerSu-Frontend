// Unified login/signup card for the LoginPage.
//
// Layout (matches the design sketch):
//   - Title row: "Login" + "Sign up instead" toggle (or vice versa)
//   - Email + password fields (login) or username + email + password
//     + confirm (signup). Forms submit on Enter; on desktop a
//     full-width arrow button row sits below the credentials and only
//     enables once the credentials are complete. On mobile the arrow
//     row is replaced by a full-width "Continue" button at the bottom
//     of the card, below the alternative login options.
//   - "OR" divider
//   - Discord + Passkey rectangular outlined buttons
//
// The submit-on-Enter forms use a hidden submit button so screen
// readers and the Enter key still submit; the buttons are visually
// hidden but DOM-present.

import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getUserManagementApi } from "../../api/UserManagementApi";
import { useUserStore } from "../../zustand/userStore";
import { WersuUserImpl } from "../../components/DiscordLogin";
import type { JsUserAuth } from "../../api/models/passkey";
import { DiscordLoginButton } from "./DiscordLoginButton";
import { PasskeyButton } from "./PasskeyButton";

/** Commit the logged-in user to the store + invalidate dependent queries. */
function commitLogin(user: JsUserAuth): void {
  useUserStore.getState().setUser(
    new WersuUserImpl({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url ?? "",
      email: user.email ?? "",
      email_verified_at: user.email_verified_at ?? "",
      is_active: user.is_active,
    }),
  );
}

type FormStatus = "idle" | "pending" | "error";

/** Default height of a MUI outlined text field / button. */
const FIELD_HEIGHT = 56;

/** Props shared by the login + signup forms. */
export interface EmailFormProps {
  /** On mobile the arrow row is replaced by a "Continue" button. */
  isMobile?: boolean;
  /** id so the card-level mobile button can submit the form. */
  formId?: string;
  /** Notifies the card whether the submit button should be enabled. */
  onReadyChange?: (ready: boolean) => void;
}

/** ids used by the card-level "Continue" button's `form` attribute. */
export const LOGIN_FORM_ID = "email-login-form";
export const SIGNUP_FORM_ID = "email-signup-form";

/**
 * Full-width submit row below the credentials.
 *
 * Disabled until the required fields are filled; a tooltip explains
 * why it is disabled. Hidden on mobile, where the card renders a
 * "Continue" button below the alternative login options instead.
 */
const CredentialsSubmit: React.FC<{
  disabled: boolean;
  label: string;
  disabledHint: string;
  enabledHint: string;
}> = ({ disabled, label, disabledHint, enabledHint }) => (
  // Tooltip needs a non-disabled wrapper: disabled buttons swallow
  // pointer events, so the span carries the hover for the hint.
  <Tooltip title={disabled ? disabledHint : enabledHint} arrow>
    <span style={{ display: "flex", width: "100%" }}>
      <Button
        type="submit"
        variant="contained"
        disabled={disabled}
        aria-label={label}
        fullWidth
        sx={{ height: FIELD_HEIGHT, borderRadius: 1 }}
      >
        <ArrowForwardIcon fontSize="small" />
      </Button>
    </span>
  </Tooltip>
);

/** POST /api/auth/login form. Submits on Enter. */
export const EmailLoginForm: React.FC<EmailFormProps> = ({
  isMobile = false,
  formId = LOGIN_FORM_ID,
  onReadyChange,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const ready = Boolean(email && password) && status !== "pending";
  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (status === "pending") return;
    if (!email || !password) return;
    setStatus("pending");
    setMessage(null);
    try {
      const user = await getUserManagementApi().loginPassword({
        kind: "password",
        email,
        password,
      });
      commitLogin(user);
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["accessToken"] });
      setStatus("idle");
      navigate("/", { replace: true });
    } catch (err) {
      const httpStatus =
        err instanceof Error &&
        "status" in err &&
        typeof err.status === "number"
          ? (err as { status: number }).status
          : 0;
      setStatus("error");
      setMessage(
        httpStatus === 401
          ? "Wrong email or password."
          : httpStatus === 400
            ? "Invalid email or password format."
            : err instanceof Error
              ? err.message
              : "Login failed.",
      );
    }
  };

  return (
    <form
      id={formId}
      onSubmit={submit}
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "pending"}
        autoComplete="email"
        fullWidth
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={status === "pending"}
        autoComplete="current-password"
        fullWidth
      />
      {status === "error" && message !== null && (
        <Alert severity="error">{message}</Alert>
      )}
      {!isMobile && (
        <CredentialsSubmit
          disabled={!ready}
          label="Log in"
          disabledHint="Enter your email and password to continue."
          enabledHint="Log in"
        />
      )}
      {/* Hidden submit keeps Enter-to-submit working for AT and keyboard. */}
      <button
        type="submit"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      />
    </form>
  );
};

/** POST /api/auth/signup form. Submits on Enter. */
export const EmailSignupForm: React.FC<EmailFormProps> = ({
  isMobile = false,
  formId = SIGNUP_FORM_ID,
  onReadyChange,
}) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const ready =
    Boolean(username && email && password && confirm) && status !== "pending";
  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (status === "pending") return;
    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }
    if (!username || !email) return;
    setStatus("pending");
    setMessage(null);
    try {
      const user = await getUserManagementApi().signup({
        username,
        email,
        password,
      });
      // Signup sets the session cookie itself (per swagger).
      commitLogin(user);
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["accessToken"] });
      setStatus("idle");
      navigate("/", { replace: true });
    } catch (err) {
      const httpStatus =
        err instanceof Error &&
        "status" in err &&
        typeof err.status === "number"
          ? (err as { status: number }).status
          : 0;
      setStatus("error");
      setMessage(
        httpStatus === 409
          ? "An account with that email already exists."
          : httpStatus === 400
            ? "Invalid signup details."
            : err instanceof Error
              ? err.message
              : "Signup failed.",
      );
    }
  };

  return (
    <form
      id={formId}
      onSubmit={submit}
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <TextField
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={status === "pending"}
        autoComplete="username"
        fullWidth
      />
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "pending"}
        autoComplete="email"
        fullWidth
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={status === "pending"}
        autoComplete="new-password"
        helperText="At least 8 characters."
        fullWidth
      />
      <TextField
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={status === "pending"}
        autoComplete="new-password"
        fullWidth
      />
      {status === "error" && message !== null && (
        <Alert severity="error">{message}</Alert>
      )}
      {!isMobile && (
        <CredentialsSubmit
          disabled={!ready}
          label="Sign up"
          disabledHint="Fill in all fields to create your account."
          enabledHint="Create account"
        />
      )}
      <button
        type="submit"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      />
    </form>
  );
};

type AuthMode = "login" | "signup";

/**
 * Unified login/signup card.
 * Title + toggle link on top, the active form below (with a
 * full-width arrow submit row on desktop), then "OR" divider and the
 * alternative login buttons. On mobile a "Continue" button sits
 * below all of that and submits the active form.
 */
export const AuthCard: React.FC<EmailFormProps> = ({ isMobile = false }) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [canContinue, setCanContinue] = useState(false);
  const isLogin = mode === "login";
  const formId = isLogin ? LOGIN_FORM_ID : SIGNUP_FORM_ID;

  return (
    <Stack spacing={3} sx={{ width: "100%", maxWidth: 360 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "baseline", justifyContent: "space-between" }}
      >
        <Typography variant="h5" component="h2">
          {isLogin ? "Login" : "Sign up"}
        </Typography>
        <Button
          variant="text"
          size="small"
          color="primary"
          onClick={() => setMode(isLogin ? "signup" : "login")}
          sx={{ textTransform: "none", minWidth: 0, px: 1 }}
        >
          {isLogin ? "Sign up instead" : "Log in instead"}
        </Button>
      </Stack>

      <Box>
        {isLogin ? (
          <EmailLoginForm
            isMobile={isMobile}
            formId={LOGIN_FORM_ID}
            onReadyChange={setCanContinue}
          />
        ) : (
          <EmailSignupForm
            isMobile={isMobile}
            formId={SIGNUP_FORM_ID}
            onReadyChange={setCanContinue}
          />
        )}
      </Box>

      <Divider sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "text.secondary", px: 1 }}>
          OR
        </Typography>
      </Divider>

      <Stack spacing={1.25}>
        <DiscordLoginButton />
        <PasskeyButton />
      </Stack>

      {isMobile && (
        <Button
          type="submit"
          form={formId}
          variant="contained"
          fullWidth
          disabled={!canContinue}
          sx={{ textTransform: "none" }}
        >
          Continue
        </Button>
      )}
    </Stack>
  );
};
