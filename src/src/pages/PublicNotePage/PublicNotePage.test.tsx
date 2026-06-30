// Tier 2 tests for the public-note page.
//
// Goal: lock in the routing-level contract the editor relies on:
//   1. The page is always in READ mode on mount (regardless of the
//      share's `permission`). The viewer is never blocked on the
//      WebSocket - the note must be visible the moment the REST
//      query resolves.
//   2. When the share grants WRITE permission, the editor's
//      read/write toggle is visible (so the user can opt into the
//      Hocuspocus session). When the share grants READ, the toggle
//      is hidden.
//   3. The note is fetched via the REST API (`useNote`) and
//      rendered with the resolved `Note`. We pin the
//      `PublicNoteEditor` props so a refactor that accidentally
//      re-wires to a different note doesn't slip through.
//   4. If the note REST query errors, we surface the error in the
//      same `PublicShareUnavailable` surface used for grant errors.
//   5. On unmount we reset `editMode` and the view config so the
//      next private-note session doesn't inherit the share grant.
//
// We mock the heavy editor surface (`PublicNoteEditor`,
// `NoteEditorSkeleton`, `PublicShareUnavailable`) so the assertions
// are about routing decisions, not Tiptap/ProseMirror. The collab
// hook is mocked away - it has its own Tier 1 tests.

// @vitest-environment jsdom

import "../../test/setup";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useAuthStore } from "../../zustand/useAuthStore";
import type { Note } from "../../api/models/search";

// ---------- Mocks ----------

const recorder = vi.hoisted(() => ({
  editorProps: [] as Array<Record<string, unknown>>,
  editorNoteIds: [] as Array<string | undefined>,
}));

vi.mock("../../api/queries/publicSharingQueries", () => ({
  usePublicShare: vi.fn(),
}));

vi.mock("../../api/queries/useShareAccessToken", () => ({
  useShareAccessToken: vi.fn(),
}));

vi.mock("../../api/queries/useNoteQueries", () => {
  return {
    useNote: vi.fn(),
    useUpdateNote: vi.fn(() => ({ mutate: vi.fn() })),
    useNoteVersion: vi.fn(),
    useLatestNotes: vi.fn(),
    useInfiniteNoteSearch: vi.fn(),
    useCreateNote: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useDeleteNote: vi.fn(() => ({ mutate: vi.fn() })),
    useMoveNote: vi.fn(() => ({ mutate: vi.fn() })),
  };
});

vi.mock("../../zustand/useThemeStore", () => ({
  useThemeStore: () => ({
    theme: { transitions: { duration: { complex: 1 } } },
  }),
}));

// The page uses `Box` and `Fade` from `@mui/material`. We mock
// the whole `@mui/material` module so we don't pull in MUI's
// internal ESM graph (the `react-transition-group/TransitionGroupContext`
// directory import breaks Vitest's default node ESM resolver).
// The mocks are dumb pass-throughs - the assertions in this file
// are about routing decisions, not MUI internals.
vi.mock("@mui/material", () => ({
  Box: ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
  } & Record<string, unknown>) => (
    <div data-mock="Box" {...rest}>
      {children}
    </div>
  ),
  Fade: ({
    children,
    in: inProp,
    unmountOnExit,
  }: {
    children?: React.ReactNode;
    in?: boolean;
    unmountOnExit?: boolean;
  }) =>
    inProp ? (
      <div data-mock="Fade">{children}</div>
    ) : unmountOnExit ? null : (
      <div data-mock="Fade" hidden>
        {children}
      </div>
    ),
}));

// `PublicNoteEditor` and `NoteEditorSkeleton` still live in
// `pages/NotePage/` - only the page wiring moved. Path goes up
// one (from `PublicNotePage/`) and over to `NotePage/`.
vi.mock("../NotePage/Editor", () => ({
  PublicNoteEditor: (props: Record<string, unknown>) => {
    recorder.editorProps.push(props);
    recorder.editorNoteIds.push(props.noteId as string | undefined);
    return (
      <div
        data-testid="public-note-editor"
        data-note-id={String(props.noteId ?? "")}
      />
    );
  },
}));

vi.mock("../NotePage/NoteEditorSkeleton", () => ({
  NoteEditorSkeleton: () => <div data-testid="editor-skeleton" />,
}));

vi.mock("./PublicShareUnavailable", () => ({
  PublicShareUnavailable: ({
    reason,
    error,
  }: {
    reason?: string;
    error?: unknown;
  }) => {
    // Mirror the real component's extraction just enough to keep
    // the test's `data-reason` attribute stable: prefer the error's
    // `.message`, then the fallback `reason`, then the empty string.
    const message =
      error instanceof Error
        ? error.message
        : typeof reason === "string"
          ? reason
          : "";
    return (
      <div
        data-testid="public-share-unavailable"
        data-reason={message}
        data-has-error={error !== undefined ? "true" : "false"}
      />
    );
  },
}));

// Stub the public collab hook so we don't open a real WebSocket. We
// keep `getPublicCollabEntry` working so the unmount cleanup
// doesn't blow up.
vi.mock("../../hooks/usePublicNoteCollaboration", () => ({
  usePublicNoteCollaboration: vi.fn(() => null),
  getPublicCollabEntry: vi.fn(() => undefined),
}));

// ---------- Imports (after mocks so the factories apply) ----------

import { usePublicShare } from "../../api/queries/publicSharingQueries";
import { useShareAccessToken } from "../../api/queries/useShareAccessToken";
import { useNote } from "../../api/queries/useNoteQueries";
import { LayoutProvider } from "../../LayoutProvider";
import { PublicNotePage } from "./Main";

const mockedPublicShare = usePublicShare as unknown as Mock;
const mockedShareAccessToken = useShareAccessToken as unknown as Mock;
const mockedNote = useNote as unknown as Mock;

const makeNote = (overrides: Partial<Note> = {}): Note =>
  ({
    id: "note-1",
    title: "Shared",
    content: "Hello world",
    stripped_content: "Hello world",
    author_id: "u-1",
    updated_at: "2026-06-30T00:00:00Z",
    permissions: [],
    get_attachment_ids: () => [],
    get_dir: () => undefined,
    ...overrides,
  }) as unknown as Note;

const renderAt = (pathname: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <LayoutProvider>
          <Routes>
            <Route path="/public/n/:share_id" element={<PublicNotePage />} />
          </Routes>
        </LayoutProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  recorder.editorProps.length = 0;
  recorder.editorNoteIds.length = 0;
  mockedPublicShare.mockReset();
  mockedShareAccessToken.mockReset();
  mockedNote.mockReset();

  // Default: still loading.
  mockedPublicShare.mockReturnValue({ data: undefined, isError: false });
  mockedNote.mockReturnValue({ data: undefined, isError: false });

  useEditorSettings.setState({ editMode: false, viewMode: "rich" });
  useViewConfig.setState({ config: { readOnly: false } });
  useAuthStore.setState({ accessToken: null, shareAccessToken: null });
});

afterEach(() => {
  // The page's cleanup is the contract being tested; the explicit
  // reset below is just a belt-and-braces guard for state that
  // escape the component's lifecycle (StrictMode double-mount, etc.).
  useEditorSettings.setState({ editMode: false, viewMode: "rich" });
  useViewConfig.setState({ config: { readOnly: false } });
});

describe("PublicNotePage - default state", () => {
  it("renders the loading skeleton while the grant is pending", () => {
    mockedPublicShare.mockReturnValue({ data: undefined, isError: false });
    mockedNote.mockReturnValue({ data: undefined, isError: false });

    renderAt("/public/n/share-1");

    expect(screen.getByTestId("editor-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("public-note-editor")).not.toBeInTheDocument();
  });

  it("shows the PublicShareUnavailable surface when the grant query errors", () => {
    mockedPublicShare.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("share not found"),
    });

    renderAt("/public/n/share-1");

    const surface = screen.getByTestId("public-share-unavailable");
    expect(surface).toBeInTheDocument();
    expect(surface.dataset.reason).toContain("share not found");
  });
});

describe("PublicNotePage - read-mode default", () => {
  it("always mounts in READ mode, even when the share grants WRITE", async () => {
    mockedPublicShare.mockReturnValue({
      data: {
        note_id: "note-1",
        permission: "SHARE_PERMISSION_WRITE",
      },
      isError: false,
    });
    mockedNote.mockReturnValue({
      data: makeNote(),
      isError: false,
    });

    renderAt("/public/n/share-1");

    await waitFor(() => {
      expect(screen.getByTestId("public-note-editor")).toBeInTheDocument();
    });

    // editMode is never flipped to true on mount. The toggle in
    // the action row is what does that, on user input.
    expect(useEditorSettings.getState().editMode).toBe(false);
  });

  it("keeps the editor visible in read mode for a READ-ONLY share", async () => {
    mockedPublicShare.mockReturnValue({
      data: {
        note_id: "note-1",
        permission: "SHARE_PERMISSION_READ",
      },
      isError: false,
    });
    mockedNote.mockReturnValue({
      data: makeNote(),
      isError: false,
    });

    renderAt("/public/n/share-1");

    await waitFor(() => {
      expect(screen.getByTestId("public-note-editor")).toBeInTheDocument();
    });

    // The toggle is hidden by viewConfig.readOnly = true.
    expect(useViewConfig.getState().config.readOnly).toBe(true);
  });

  it("leaves the write toggle visible for a WRITE share", async () => {
    mockedPublicShare.mockReturnValue({
      data: {
        note_id: "note-1",
        permission: "SHARE_PERMISSION_WRITE",
      },
      isError: false,
    });
    mockedNote.mockReturnValue({
      data: makeNote(),
      isError: false,
    });

    renderAt("/public/n/share-1");

    await waitFor(() => {
      expect(screen.getByTestId("public-note-editor")).toBeInTheDocument();
    });

    // readOnly=false is what makes the toggle (and the save button)
    // appear in the editor's action row.
    expect(useViewConfig.getState().config.readOnly).toBe(false);
  });
});

describe("PublicNotePage - note fetch error path", () => {
  it("surfaces a note-fetch error via PublicShareUnavailable", async () => {
    mockedPublicShare.mockReturnValue({
      data: {
        note_id: "note-1",
        permission: "SHARE_PERMISSION_READ",
      },
      isError: false,
    });
    mockedNote.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("note not found"),
    });

    renderAt("/public/n/share-1");

    await waitFor(() => {
      expect(
        screen.getByTestId("public-share-unavailable"),
      ).toBeInTheDocument();
    });
    const surface = screen.getByTestId("public-share-unavailable");
    expect(surface.dataset.reason).toContain("note not found");
    expect(screen.queryByTestId("public-note-editor")).not.toBeInTheDocument();
  });
});

describe("PublicNotePage - note rendering", () => {
  it("passes the grant-resolved noteId to the editor", async () => {
    mockedPublicShare.mockReturnValue({
      data: {
        note_id: "note-1",
        permission: "SHARE_PERMISSION_READ",
      },
      isError: false,
    });
    mockedNote.mockReturnValue({
      data: makeNote({ id: "note-1", title: "Pinned" }),
      isError: false,
    });

    renderAt("/public/n/share-1");

    await waitFor(() => {
      expect(screen.getByTestId("public-note-editor")).toBeInTheDocument();
    });

    const editor = screen.getByTestId("public-note-editor");
    expect(editor.dataset.noteId).toBe("note-1");
    expect(recorder.editorNoteIds).toContain("note-1");
  });
});

describe("PublicNotePage - error forwarding", () => {
  it("forwards the raw grant error to PublicShareUnavailable (not just the message)", () => {
    // The contract: the page passes `error` (the raw Error) so the
    // 404 surface can surface the HTTP status + response body in its
    // diagnostic accordion. The mock flips `data-has-error="true"`
    // when the `error` prop is present, so we can assert the wiring
    // without coupling to the real component's internals.
    const grantError = new Error("share not found");
    mockedPublicShare.mockReturnValue({
      data: undefined,
      isError: true,
      error: grantError,
    });

    renderAt("/public/n/share-1");

    const surface = screen.getByTestId("public-share-unavailable");
    expect(surface.dataset.hasError).toBe("true");
    // `data-reason` is the message fallback - keep it pinned so
    // the friendly surface still works when the consumer only has
    // a string.
    expect(surface.dataset.reason).toContain("share not found");
  });

  it("forwards the raw note error to PublicShareUnavailable", async () => {
    const noteError = new Error("note not found");
    mockedPublicShare.mockReturnValue({
      data: {
        note_id: "note-1",
        permission: "SHARE_PERMISSION_READ",
      },
      isError: false,
    });
    mockedNote.mockReturnValue({
      data: undefined,
      isError: true,
      error: noteError,
    });

    renderAt("/public/n/share-1");

    await waitFor(() => {
      expect(
        screen.getByTestId("public-share-unavailable"),
      ).toBeInTheDocument();
    });
    const surface = screen.getByTestId("public-share-unavailable");
    expect(surface.dataset.hasError).toBe("true");
    expect(surface.dataset.reason).toContain("note not found");
  });
});
