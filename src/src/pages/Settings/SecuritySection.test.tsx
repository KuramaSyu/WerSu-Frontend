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

// Default: Discord + password are linked, no passkeys. Wire shape
// uses the proto enum numbers (1 = Discord, 3 = Password) because
// that is what the Go backend JSON-encodes.
let mockCredentials: {
  isSuccess: boolean;
  data?: {
    credentials: Array<{
      kind: number | string;
      identifier?: string;
      id?: string;
      user_id?: string;
      created_at?: unknown;
      Payload?: Record<string, unknown>;
      [key: string]: unknown;
    }>;
    passkeys: Array<{
      id: string;
      created_at?: unknown;
      last_used_at?: unknown;
      revoked_at?: unknown;
      friendly_name?: string;
      credential_id?: string;
      [key: string]: unknown;
    }>;
  };
} = {
  isSuccess: true,
  data: {
    credentials: [{ kind: 1 }, { kind: 2 }],
    passkeys: [],
  },
};

vi.mock("../../api/queries/linkedProvidersQueries", async () => {
  // Mirror the production summary hook against the (mocked)
  // credentials. The Discord `id` field is wired straight to the
  // real `DiscordLinkedAccountImpl` from `utils/DiscordLinkedAccount`,
  // so the snowflake math is exercised through the production class.
  const { DiscordLinkedAccountImpl } =
    await import("../../utils/DiscordLinkedAccount");
  function isProtoTimestampUnset(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  }
  function kindLabel(
    kind: unknown,
  ): "discord" | "google" | "password" | undefined {
    // Mirrors LINKED_PROVIDER_KIND_NUMBER on the production side
    // (DISCORD=1, PASSWORD=2, GOOGLE=3).
    if (kind === 1) return "discord";
    if (kind === 2) return "password";
    if (kind === 3) return "google";
    return undefined;
  }
  return {
    useLinkedCredentials: () => mockCredentials,
    linkedProvidersKeys: {
      all: ["linked-providers"],
      credentials: () => ["linked-providers", "credentials"],
    },
    useLinkedProvidersSummary: () => {
      const reply =
        mockCredentials.isSuccess && mockCredentials.data
          ? mockCredentials.data
          : undefined;
      const discordCred = reply?.credentials.find(
        (c) => kindLabel(c.kind) === "discord",
      );
      const discordId =
        discordCred && discordCred.Payload
          ? (discordCred.Payload as Record<string, unknown>).DiscordId
          : undefined;
      const discord =
        typeof discordId === "string"
          ? new DiscordLinkedAccountImpl(discordId)
          : undefined;
      return {
        ready: mockCredentials.isSuccess,
        discordLinked: reply
          ? reply.credentials.some((c) => kindLabel(c.kind) === "discord")
          : null,
        passwordSet: reply
          ? reply.credentials.some((c) => kindLabel(c.kind) === "password")
          : null,
        activePasskeyCount: reply
          ? (reply.passkeys ?? []).filter((p) =>
              isProtoTimestampUnset(p.revoked_at),
            ).length
          : null,
        discord,
      };
    },
  };
});

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
    Avatar: ({ src, alt }: { src?: string; alt?: string }) => (
      <img data-testid="mui-avatar" src={src} alt={alt} />
    ),
    Box: passthrough("div"),
    Link: ({
      children,
      href,
      target,
      rel,
    }: {
      children?: ReactNode;
      href?: string;
      target?: string;
      rel?: string;
    }) => (
      <a data-testid="mui-link" href={href} target={target} rel={rel}>
        {children}
      </a>
    ),
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
      credentials: [{ kind: 1 }, { kind: 2 }],
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
    // Discord-only account: no password credential kind.
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: 1 }],
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

  // While the credentials query is in flight we default to "no password"
  // so a Discord-only account never sees a "Current password" field
  // flash in and out on first paint.
  it("hides the current password field while credentials are loading", () => {
    mockCredentials = { isSuccess: false };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.getByText("Set password")).toBeInTheDocument();
  });

  it("renders the Discord row from /auth/me/credentials instead of avatar_url", () => {
    mockCredentials = {
      isSuccess: true,
      data: { credentials: [{ kind: 2 }], passkeys: [] },
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
      data: { credentials: [{ kind: 1 }], passkeys: [] },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("Not set.")).toBeInTheDocument();
  });

  it("counts only active passkeys in the passkey row", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: 1 }, { kind: 2 }],
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

  // Pins the actual wire shape from GET /api/auth/me/credentials: the
  // backend serializes a nil proto Timestamp as `{}`, and an empty
  // `revoked_at` means the passkey is still active.
  it("counts a passkey as active when the wire returns empty timestamp objects", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: 1 }, { kind: 2 }],
        passkeys: [
          {
            id: "p1",
            created_at: {},
            last_used_at: {},
            revoked_at: {},
          },
        ],
      },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("1 registered.")).toBeInTheDocument();
  });

  it("counts a passkey as revoked when the wire returns a set revoked_at timestamp", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: 1 }, { kind: 2 }],
        passkeys: [
          {
            id: "p1",
            created_at: { seconds: 1, nanos: 0 },
            revoked_at: { seconds: 2, nanos: 0 },
          },
        ],
      },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("None registered.")).toBeInTheDocument();
  });

  it("shows None registered when no active passkeys remain", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [{ kind: 1 }, { kind: 2 }],
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

  // Pin the regression that motivated the refactor: the backend sends
  // `kind` as the proto enum number (1 = Discord, 2 = Google, 3 = Password),
  // not a lowercase string. The Settings card used to compare against
  // "discord" / "password" literals and rendered "Not linked." for
  // every row, including the user's Discord + Password + Passkey
  // account. Verify the full happy path against the actual wire shape.
  it("renders Discord + Password + active passkey from the proto-number wire", () => {
    mockCredentials = {
      isSuccess: true,
      data: {
        credentials: [
          {
            id: "discord-row",
            user_id: "u1",
            kind: 1,
            created_at: { seconds: 1786138329, nanos: 239304000 },
            Payload: { DiscordId: "362262726191349761" },
          },
          {
            id: "password-row",
            user_id: "u1",
            kind: 2,
            created_at: { seconds: 1792193351, nanos: 589187000 },
            Payload: { PasswordHash: "$argon2id$..." },
          },
        ],
        passkeys: [
          {
            id: "p1",
            credential_id: "39up3Mh6QaGOY0rds4DTSg==",
            created_at: {},
            last_used_at: {},
            revoked_at: {},
          },
        ],
      },
    };
    render(<SecuritySection />, { wrapper: buildWrapper(qc) });
    expect(screen.getByText("Set.")).toBeInTheDocument();
    expect(screen.getByText("1 registered.")).toBeInTheDocument();
    // Password is set -> the current-password field must render and
    // the button must read "Update password".
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByText("Update password")).toBeInTheDocument();

    // Discord row renders the snowflake, the deterministic default
    // avatar, and the account-creation date derived from the
    // snowflake. The default-avatar index is `(id >> 22) % 5`, which
    // for 362262726191349761 is 0.
    const avatar = screen.getByTestId("mui-avatar");
    expect(avatar.getAttribute("src")).toBe(
      "https://cdn.discordapp.com/embed/avatars/0.png",
    );
    // 362262726191349761 >> 22 + 1_420_070_400_000 ms = 2017-09-26.
    // Pin the ISO day so a future epoch regression fails loudly.
    // The id is rendered inside an <a>, so the surrounding text is
    // split across nodes; check that the full sentence appears in the DOM.
    expect(document.body.textContent ?? "").toContain(
      "Linked as 362262726191349761 (created 2017-09-26).",
    );
    // The id is wrapped in a link to the Discord profile so users
    // can verify the linked account from the settings page.
    const profileLink = screen.getByTestId("mui-link");
    expect(profileLink.getAttribute("href")).toBe(
      "https://discord.com/users/362262726191349761",
    );
    expect(profileLink.textContent).toBe("362262726191349761");
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
