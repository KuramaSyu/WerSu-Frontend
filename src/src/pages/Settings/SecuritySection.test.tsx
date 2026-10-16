// Tier 1 tests for the SecuritySection component.

// @vitest-environment jsdom

import "../../test/setup";

vi.mock("@material/material-color-utilities", () => ({}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { SecuritySection } from "./SecuritySection";
import { useUserStore } from "../../zustand/userStore";
import { WersuUserImpl } from "../../components/DiscordLogin";
import { ApiError } from "../../api/SharingApi";

const buildWrapper =
  (qc: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

const mockChangePassword = vi.fn().mockResolvedValue(undefined);
const mockPatchUser = vi.fn().mockResolvedValue({
  id: "u1",
  username: "alice2",
  avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
  email: "alice@example.com",
  email_verified_at: "",
  is_active: true,
});

const mockLinkMutate = vi.fn();
let mockLinkPending = false;
let mockLinkSupported = true;

// Default: Discord + password are linked, no passkeys — matches the
// legacy "everything is set up" assumption the page used to make when
// it had to read state off avatar_url and an inferred flag.
let mockCredentials: {
  isSuccess: boolean;
  data?: {
    credentials: Array<{ kind: string; identifier?: string }>;
    passkeys: Array<{
      id: string;
      created_at: string;
      revoked_at?: string;
      friendly_name?: string;
    }>;
  };
} = {
  isSuccess: true,
  data: {
    credentials: [{ kind: "discord" }, { kind: "password" }],
    passkeys: [],
  },
};

vi.mock("../../api/queries/linkedProvidersQueries", () => ({
  useLinkedCredentials: () => mockCredentials,
  linkedProvidersKeys: {
    all: ["linked-providers"],
    credentials: () => ["linked-providers", "credentials"],
  },
}));

vi.mock("../../hooks/usePasskeyCeremony", () => ({
  usePasskeyLink: () => ({
    mutate: mockLinkMutate,
    isPending: mockLinkPending,
  }),
  usePasskeyLogin: () => ({ mutate: vi.fn(), isPending: false }),
  usePasskeyRegister: () => ({ mutate: vi.fn(), isPending: false }),
  isWebAuthnSupported: () => mockLinkSupported,
  WebAuthnUnavailableError: class WebAuthnUnavailableError extends Error {},
}));

vi.mock("../../api/UserManagementApi", () => ({
  getUserManagementApi: () => ({
    changePassword: mockChangePassword,
    patchUser: mockPatchUser,
    createUser: vi.fn(),
    signup: vi.fn(),
    loginPassword: vi.fn(),
  }),
  IUserManagementApi: class {},
  UserManagementApi: class {},
  USER_MANAGEMENT_API_TOKEN: Symbol("UserManagementApi"),
}));

const mockUseUserData = {
  id: "u1",
  username: "alice",
  avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
  email: "alice@example.com",
  email_verified_at: "",
  is_active: true,
};

vi.mock("../../api/queries/useUser", () => ({
  useUser: () => ({
    data: new WersuUserImpl(mockUseUserData),
    isSuccess: true,
  }),
}));

// The client ships plaintext; the server handles password handling.

vi.mock("../../zustand/useThemeStore", () => ({
  useThemeStore: () => ({
    theme: { palette: { text: { primary: "#000" } } },
    setTheme: vi.fn(),
  }),
}));

vi.mock("@mui/material", () => {
  const passthrough = (name: string) => {
    const Cmp = ({
      children,
      ...rest
    }: { children?: ReactNode } & Record<string, unknown>) => {
      const Tag = name as keyof React.JSX.IntrinsicElements;
      return <Tag {...(rest as Record<string, unknown>)}>{children}</Tag>;
    };
    Cmp.displayName = name;
    return Cmp;
  };
  return {
    // Needed to keep the import chain alive: SecuritySection -> useUser
    // -> DiscordLogin -> useThemeStore -> themes.ts -> createTheme.
    createTheme: () => ({}),
    Alert: ({
      children,
      severity,
    }: {
      children?: ReactNode;
      severity?: string;
    }) => (
      <div role="alert" data-severity={severity}>
        {children}
      </div>
    ),
    Box: passthrough("div"),
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Card: passthrough("section"),
    CardContent: passthrough("div"),
    CardHeader: ({
      title,
      subheader,
    }: {
      title?: ReactNode;
      subheader?: ReactNode;
    }) => (
      <div>
        <h3>{title}</h3>
        <p>{subheader}</p>
      </div>
    ),
    CircularProgress: () => <span data-testid="progress" />,
    Stack: passthrough("div"),
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

vi.mock("@mui/icons-material/VpnKey", () => ({
  default: () => <i data-testid="icon-key" />,
}));
vi.mock("@mui/icons-material/Person", () => ({
  default: () => <i data-testid="icon-person" />,
}));
vi.mock("@mui/icons-material/Lock", () => ({
  default: () => <i data-testid="icon-lock" />,
}));
vi.mock(
  "@mui/icons-material",
  () =>
    new Proxy(
      {},
      {
        get: (_target, prop) => () => (
          <i data-testid={`icon-${String(prop).toLowerCase()}`} />
        ),
      },
    ),
);

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockChangePassword.mockClear();
  mockPatchUser.mockClear();
  mockLinkMutate.mockReset();
  mockLinkPending = false;
  mockLinkSupported = true;
  mockCredentials = {
    isSuccess: true,
    data: {
      credentials: [{ kind: "discord" }, { kind: "password" }],
      passkeys: [],
    },
  };
  useUserStore.setState({ user: new WersuUserImpl(mockUseUserData) });
});

afterEach(() => {
  useUserStore.setState({ user: null });
});

describe("SecuritySection", () => {
  it("renders all three cards with their titles", () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("Change password")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Linked sign-in methods")).toBeInTheDocument();
  });

  it("ships plaintext current and new_password to changePassword", async () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-pw" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.click(screen.getByText("Update password"));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    const args = mockChangePassword.mock.calls[0][0];
    expect(args).toEqual({
      current: "current-pw",
      new_password: "new-pw-1",
    });
  });

  it("rejects mismatched new passwords before hitting the API", async () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-pw" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByText("Update password"));
    await waitFor(() =>
      expect(screen.getByText(/do not match/i)).toBeInTheDocument(),
    );
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("patchUser sends exactly one of {field} or {field_clear} per submit", async () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice2" },
    });
    fireEvent.click(screen.getAllByText("Save")[0]);
    await waitFor(() => expect(mockPatchUser).toHaveBeenCalledTimes(1));
    const [id, payload] = mockPatchUser.mock.calls[0];
    expect(id).toBe("u1");
    expect(payload).toEqual({ username: "alice2" });
    expect(payload).not.toHaveProperty("username_clear");
  });

  it("writes the new user to the store on a successful self-patch", async () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice2" },
    });
    fireEvent.click(screen.getAllByText("Save")[0]);
    await waitFor(() => expect(mockPatchUser).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const stored = useUserStore.getState().user;
      expect(stored).not.toBeNull();
      expect(stored?.username).toBe("alice2");
    });
  });

  it("renders the add passkey button when WebAuthn is supported", () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    const button = screen.getByText("Add passkey").closest("button");
    expect(button).not.toBeNull();
    expect(button).not.toBeDisabled();
  });

  it("clicking add passkey invokes the link mutation", () => {
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByText("Add passkey"));
    expect(mockLinkMutate).toHaveBeenCalledTimes(1);
  });

  it("disables add passkey when WebAuthn is unsupported", () => {
    mockLinkSupported = false;
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    const button = screen.getByText("Add passkey").closest("button");
    expect(button).toBeDisabled();
    expect(screen.getByText(/WebAuthn isn't available/i)).toBeInTheDocument();
    fireEvent.click(button as HTMLElement);
    expect(mockLinkMutate).not.toHaveBeenCalled();
  });

  it("disables add passkey while the link mutation is pending", () => {
    mockLinkPending = true;
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(
      (screen.getByText("Add passkey").closest("button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows an error alert when the link mutation fails", async () => {
    mockLinkMutate.mockImplementationOnce(
      (_vars: unknown, opts?: { onError?: (e: Error) => void }) => {
        opts?.onError?.(new Error("Browser refused the prompt."));
      },
    );
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByText("Add passkey"));
    await waitFor(() =>
      expect(
        screen.getByText("Browser refused the prompt."),
      ).toBeInTheDocument(),
    );
  });

  it("shows a success label after the link mutation succeeds", async () => {
    mockLinkMutate.mockImplementationOnce(
      (_vars: unknown, opts?: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByText("Add passkey"));
    await waitFor(() =>
      expect(screen.getByText("Passkey added.")).toBeInTheDocument(),
    );
  });

  it("shows a clear error when the server reports passkey support is not configured", async () => {
    mockLinkMutate.mockImplementationOnce(
      (_vars: unknown, opts?: { onError?: (e: Error) => void }) => {
        opts?.onError?.(
          new Error("passkey support is not configured (WEBAUTHN_RP_ID unset)"),
        );
      },
    );
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByText("Add passkey"));
    await waitFor(() =>
      expect(
        screen.getByText(/aren't configured on this server/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Not available on this server/i),
    ).toBeInTheDocument();
  });

  it("disables add passkey after a server-side unconfigured error", async () => {
    mockLinkMutate.mockImplementationOnce(
      (_vars: unknown, opts?: { onError?: (e: Error) => void }) => {
        opts?.onError?.(
          new Error("passkey support is not configured (WEBAUTHN_RP_ID unset)"),
        );
      },
    );
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    fireEvent.click(screen.getByText("Add passkey"));
    await waitFor(() =>
      expect(
        screen.getByText(/aren't configured on this server/i),
      ).toBeInTheDocument(),
    );
    const button = screen
      .getByText("Add passkey")
      .closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("hides the current password field when no password credential is linked", async () => {
    // Discord-only account: no "password" credential kind.
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: "discord" }],
        passkeys: [],
      },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    // No current field, button label flipped to "Set password".
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.getByText("Set password")).toBeInTheDocument();

    // Submitting sends only the new password (no `current` key).
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.click(screen.getByText("Set password"));
    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    const payload = mockChangePassword.mock.calls[0][0];
    expect(payload).toEqual({ new_password: "new-pw-1" });
    expect(payload).not.toHaveProperty("current");
  });

  it("renders the Discord row from /auth/me/credentials instead of avatar_url", () => {
    mockCredentials = {
      isSuccess: true,
      data: { credentials: [{ kind: "password" }], passkeys: [] },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    // The legacy Discord-avatar URL is still on the user, but the
    // section must NOT infer Discord linkage from it — only from
    // the credentials payload.
    expect(screen.getByText("Not linked.")).toBeInTheDocument();
  });

  it("renders the password row from credentials (Not set)", () => {
    mockCredentials = {
      isSuccess: true,
      data: { credentials: [{ kind: "discord" }], passkeys: [] },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("Not set.")).toBeInTheDocument();
  });

  it("counts only active passkeys in the passkey row", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: "discord" }, { kind: "password" }],
        passkeys: [
          { id: "p1", created_at: "2024-01-01T00:00:00Z" },
          { id: "p2", created_at: "2024-01-02T00:00:00Z" },
          {
            id: "p3",
            created_at: "2024-01-03T00:00:00Z",
            revoked_at: "2024-02-01T00:00:00Z",
          },
        ],
      },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    // Two active, one revoked -> "2 registered."
    expect(screen.getByText("2 registered.")).toBeInTheDocument();
  });

  it("shows None registered when no active passkeys remain", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: "discord" }, { kind: "password" }],
        passkeys: [
          {
            id: "p1",
            created_at: "2024-01-01T00:00:00Z",
            revoked_at: "2024-02-01T00:00:00Z",
          },
        ],
      },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("None registered.")).toBeInTheDocument();
  });

  it("keeps the current password field on a 400 that is not 'no password set'", async () => {
    mockChangePassword.mockRejectedValueOnce(
      new ApiError("New password rejected by policy", 400, {
        message: "New password rejected by policy",
      }),
    );
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-pw" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.click(screen.getByText("Update password"));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    // Current field stays; alert reads "New password is invalid."
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByText(/New password is invalid/i)).toBeInTheDocument();
  });

  it("keeps the current password field on a 400 that is not 'no password set'", async () => {
    mockChangePassword.mockRejectedValueOnce(
      new ApiError("New password rejected by policy", 400, {
        message: "New password rejected by policy",
      }),
    );
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-pw" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-pw-1" },
    });
    fireEvent.click(screen.getByText("Update password"));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    // Current field stays; alert reads "New password is invalid."
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByText(/New password is invalid/i)).toBeInTheDocument();
  });
});
