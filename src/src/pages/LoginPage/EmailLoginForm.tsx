// Unified login/signup card for the LoginPage.
//
// Layout (matches the design sketch):
//   - Title row: "Login" + "Sign up instead" toggle (or vice versa)
//   - Email + password fields (login) or username + email + password
//     + confirm (signup). Forms submit on Enter; no visible submit button
//     keeps the focus on the alternative-login buttons below.
//   - "OR" divider
//   - Discord + Passkey rectangular outlined buttons
//
// The submit-on-Enter forms use a hidden submit button so screen
// readers and the Enter key still submit; the buttons are visually
// hidden but DOM-present.

import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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

/** POST /api/auth/login form. Submits on Enter. */
export const EmailLoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
export const EmailSignupForm: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
 * Title + toggle link on top, the active form below, then "OR"
 * divider and the alternative login buttons.
 */
export const AuthCard: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const isLogin = mode === "login";

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

      <Box>{isLogin ? <EmailLoginForm /> : <EmailSignupForm />}</Box>

      <Divider sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "text.secondary", px: 1 }}>
          OR
        </Typography>
      </Divider>

      <Stack spacing={1.25}>
        <DiscordLoginButton />
        <PasskeyButton />
      </Stack>
    </Stack>
  );
};
