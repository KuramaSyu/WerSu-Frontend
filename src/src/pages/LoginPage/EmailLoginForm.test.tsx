// Tier 1 tests for the LoginPage email/password forms and the
// unified AuthCard layout.

// @vitest-environment jsdom

import "../../test/setup";

vi.mock("@material/material-color-utilities", () => ({}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import { AuthCard, EmailLoginForm, EmailSignupForm } from "./EmailLoginForm";
import { useUserStore } from "../../zustand/userStore";

const mockLoginPassword = vi.fn();
const mockSignup = vi.fn();

vi.mock("../../api/UserManagementApi", () => ({
  getUserManagementApi: () => ({
    loginPassword: mockLoginPassword,
    signup: mockSignup,
    createUser: vi.fn(),
    patchUser: vi.fn(),
    changePassword: vi.fn(),
  }),
  IUserManagementApi: class {},
  UserManagementApi: class {},
  USER_MANAGEMENT_API_TOKEN: Symbol("UserManagementApi"),
}));

// The client ships plaintext; the server handles password handling.

vi.mock("../../zustand/useThemeStore", () => ({
  useThemeStore: () => ({
    theme: { palette: { text: { primary: "#000" } } },
    setTheme: vi.fn(),
  }),
}));

// Stub the default theme so tests don't have to load themes.ts (which
// inits a chain of CustomThemeImpl instances that pulls real MUI
// internals into the module graph). Factory is hoisted, so the
// palette shape lives inside the factory.
vi.mock("../../theme/themes", () => ({
  defaultTheme: {
    palette: {
      contrastThreshold: 3,
      text: { primary: "#000" },
      background: { default: "#fff", paper: "#fff" },
      primary: { main: "#88c0d0" },
    },
  },
}));

vi.mock("@mui/material", () => {
  const passthrough = (name: string) => {
    const Cmp = ({
      children,
      ...rest
    }: {
      children?: ReactNode;
    } & Record<string, unknown>) => {
      const Tag = name as keyof React.JSX.IntrinsicElements;
      return <Tag {...(rest as Record<string, unknown>)}>{children}</Tag>;
    };
    Cmp.displayName = name;
    return Cmp;
  };
  return {
    // Keeps the import chain alive through createTheme.
    createTheme: () => ({}),
    Alert: ({ children }: { children?: ReactNode }) => (
      <div role="alert">{children}</div>
    ),
    Button: ({
      children,
      onClick,
      disabled,
      type,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      type?: "button" | "reset" | "submit";
    }) => (
      <button type={type ?? "button"} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Box: passthrough("div"),
    CircularProgress: () => <span data-testid="progress" />,
    Divider: ({ children }: { children?: ReactNode }) => (
      <div role="separator">{children}</div>
    ),
    Stack: passthrough("div"),
    ThemeProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Tab: ({
      label,
      value,
      onClick,
    }: {
      label?: ReactNode;
      value?: string;
      onClick?: () => void;
    }) => (
      <button type="button" role="tab" data-value={value} onClick={onClick}>
        {label}
      </button>
    ),
    Tabs: ({
      children,
      value,
      onChange,
    }: {
      children?: ReactNode;
      value?: string;
      onChange?: (_: unknown, next: string) => void;
    }) => (
      <div data-active-tab={value}>
        {Array.isArray(children)
          ? children.map((child, i) =>
              child
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ((c: any) => (
                    <span
                      key={i}
                      onClick={() => onChange?.(undefined, c.props.value)}
                    >
                      {c}
                    </span>
                  ))(child)
                : null,
            )
          : children}
      </div>
    ),
    TextField: ({
      label,
      value,
      onChange,
      disabled,
      type,
    }: {
      label?: string;
      value?: string;
      onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
      disabled?: boolean;
      type?: string;
    }) => (
      <label>
        <span>{label}</span>
        <input
          aria-label={label}
          value={value ?? ""}
          onChange={onChange}
          disabled={disabled}
          type={type}
        />
      </label>
    ),
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

const buildWrapper =
  (qc: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

class FakeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let qc: QueryClient;

beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockLoginPassword.mockReset();
  mockSignup.mockReset();
  useUserStore.setState({ user: null });
});

afterEach(() => {
  useUserStore.setState({ user: null });
});

describe("EmailLoginForm", () => {
  it("POSTs to loginPassword with { kind: 'password', email, password } as plaintext", async () => {
    mockLoginPassword.mockResolvedValue({
      id: "u1",
      username: "alice",
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
      email: "alice@example.com",
      email_verified_at: "",
      is_active: true,
    });
    render(<EmailLoginForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "raw-password-pw" },
    });
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

    await waitFor(() => expect(mockLoginPassword).toHaveBeenCalledTimes(1));
    const args = mockLoginPassword.mock.calls[0][0];
    expect(args).toEqual({
      kind: "password",
      email: "alice@example.com",
      password: "raw-password-pw",
    });
  });

  it("writes the logged-in user to the store on success", async () => {
    mockLoginPassword.mockResolvedValue({
      id: "u1",
      username: "alice",
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
      email: "alice@example.com",
      email_verified_at: "",
      is_active: true,
    });
    render(<EmailLoginForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pw" },
    });
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
    await waitFor(() =>
      expect(useUserStore.getState().user?.username).toBe("alice"),
    );
  });

  it("surfaces a 401 as inline error", async () => {
    mockLoginPassword.mockRejectedValue(new FakeApiError("unauthorized", 401));
    render(<EmailLoginForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(/wrong email or password/i)).toBeInTheDocument(),
    );
  });
});

describe("EmailSignupForm", () => {
  it("POSTs to signup with plaintext password and does NOT trigger a follow-up login", async () => {
    mockSignup.mockResolvedValue({
      id: "u1",
      username: "alice",
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
      email: "alice@example.com",
      email_verified_at: "",
      is_active: true,
    });
    render(<EmailSignupForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "raw-password-pw" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "raw-password-pw" },
    });
    const form = screen.getByLabelText("Confirm password").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => expect(mockSignup).toHaveBeenCalledTimes(1));
    const args = mockSignup.mock.calls[0][0];
    expect(args).toEqual({
      username: "alice",
      email: "alice@example.com",
      password: "raw-password-pw",
    });
    // Cookie is set by the backend on signup; no follow-up login.
    expect(mockLoginPassword).not.toHaveBeenCalled();
  });

  it("surfaces a 409 as inline error and does not call login", async () => {
    mockSignup.mockRejectedValue(new FakeApiError("conflict", 409));
    render(<EmailSignupForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "abcdefgh" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "abcdefgh" },
    });
    const form = screen.getByLabelText("Confirm password").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByText(/already exists/i)).toBeInTheDocument(),
    );
    expect(mockLoginPassword).not.toHaveBeenCalled();
  });

  it("rejects short passwords before hitting the API", async () => {
    render(<EmailSignupForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "short" },
    });
    const form = screen.getByLabelText("Confirm password").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument(),
    );
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before hitting the API", async () => {
    render(<EmailSignupForm />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "abcdefgh" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different" },
    });
    const form = screen.getByLabelText("Confirm password").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByText(/do not match/i)).toBeInTheDocument(),
    );
    expect(mockSignup).not.toHaveBeenCalled();
  });
});

describe("AuthCard (unified login/signup card)", () => {
  it("renders the login form by default with the toggle link and OR divider", () => {
    render(<AuthCard />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Sign up instead")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("OR")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /discord/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /passkey/i }),
    ).toBeInTheDocument();
    // Signup-only fields are hidden in login mode.
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });

  it("clicking the toggle swaps to signup mode with extra fields and a new toggle label", () => {
    render(<AuthCard />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByRole("button", { name: "Sign up instead" }));
    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.getByText("Log in instead")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("clicking the toggle from signup returns to login mode", () => {
    render(<AuthCard />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByRole("button", { name: "Sign up instead" }));
    fireEvent.click(screen.getByRole("button", { name: "Log in instead" }));
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });
});
