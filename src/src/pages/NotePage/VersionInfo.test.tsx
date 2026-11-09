// Tier 1 tests for `useVersionRestore`, plus a Tier 2 smoke test
// confirming `VersionInfo` wires the drawer's `onRestoreVersion` to the
// hook.
//
// The restore/load flow is display-only: it fetches the requested
// version and mirrors it into the editor store with
// `setTitle` + `replaceContent`. It must never call a restore endpoint,
// a save mutation or invalidate the note queries, so no new version is
// created in either read or edit mode.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useVersionRestore } from "./VersionInfo.hooks";
import { VersionInfo } from "./VersionInfo";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { Note } from "../../api/models/search";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

const drawerCapture = vi.hoisted(() => ({
  onRestoreVersion: null as null | ((v: unknown) => Promise<void>),
}));

// The load hook fetches the selected version through the registered
// API singleton. Swap it for a controllable fake.
const apiCapture = vi.hoisted(() => ({
  getVersion: vi.fn(),
  get: vi.fn(),
}));
vi.mock("../../api/NoteApi", () => ({
  getNoteApi: () => apiCapture,
  NoteApi: class {
    getVersion = apiCapture.getVersion;
  },
}));

// Stubs avoid pulling in @mui/material's react-transition-group /
// material-color-utilities ESM graph when VersionInfo imports @mui.
vi.mock("@material/material-color-utilities", () => ({}));
vi.mock("@mui/material/styles", () => ({}));
vi.mock("@mui/material", () => ({
  Box: (p: { children?: React.ReactNode }) => p.children ?? null,
  Button: (p: { onClick?: () => void; children?: React.ReactNode }) => (
    <button onClick={p.onClick}>{p.children}</button>
  ),
  Chip: () => null,
  Avatar: () => null,
  IconButton: () => null,
  Stack: (p: { children?: React.ReactNode }) => p.children ?? null,
  Grow: (p: { children?: React.ReactNode }) => p.children ?? null,
  Grid: (p: { children?: React.ReactNode }) => p.children ?? null,
  Typography: (p: { children?: React.ReactNode }) => p.children ?? null,
  Badge: (p: { children?: React.ReactNode }) => p.children ?? null,
  Tooltip: (p: { children?: React.ReactNode }) => p.children ?? null,
  Paper: (p: { children?: React.ReactNode }) => p.children ?? null,
  Popper: (p: { children?: React.ReactNode }) => p.children ?? null,
  CircularProgress: () => null,
  ToggleButtonGroup: (p: { children?: React.ReactNode }) =>
    p.children ?? null,
  ToggleButton: (p: { children?: React.ReactNode }) => p.children ?? null,
}));
vi.mock("@mui/lab/Timeline", () => ({
  default: (p: { children?: React.ReactNode }) => p.children ?? null,
}));
vi.mock("@mui/lab/TimelineItem", () => ({
  default: (p: { children?: React.ReactNode }) => p.children ?? null,
  timelineItemClasses: {},
}));
vi.mock("@mui/lab/TimelineSeparator", () => ({
  default: (p: { children?: React.ReactNode }) => p.children ?? null,
}));
vi.mock("@mui/lab/TimelineConnector", () => ({
  default: () => null,
}));
vi.mock("@mui/lab/TimelineContent", () => ({
  default: (p: { children?: React.ReactNode }) => p.children ?? null,
  timelineContentClasses: {},
}));
vi.mock("@mui/lab/TimelineDot", () => ({
  default: () => null,
}));
vi.mock("@tabler/icons-react", () => ({
  IconChevronDown: () => null,
  IconChevronUp: () => null,
  IconDropletFilled: () => null,
}));
vi.mock("../../components/Panels/PanelSection", () => ({
  PanelSection: ({ children }: { children?: React.ReactNode }) =>
    children ?? null,
}));
vi.mock("./CollabStatusBadge", () => ({
  CollabStatusBadge: () => null,
}));
vi.mock("../../zustand/useThemeStore", () => ({
  useThemeStore: () => ({
    theme: {
      palette: {
        primary: { main: "#888", dark: "#444" },
        secondary: { main: "#888", dark: "#444" },
        background: { default: "#fff", paper: "#fff" },
        text: { primary: "#000" },
      },
      shape: { borderRadius: 4 },
      transitions: {
        duration: { complex: 300 },
        create: () => "all 300ms",
      },
      spacing: (n: number) => `${n * 8}px`,
    },
  }),
}));

vi.mock("../../zustand/useLiveUsersStore", () => ({
  useLiveUsers: () => [],
}));
vi.mock("../../api/queries/useUser", () => ({
  useUser: () => ({ data: { id: "u-1", username: "tester" } }),
  useUsers: () => ({ data: {} }),
}));
vi.mock("../../api/queries/recentActivity", () => ({
  useNoteActivity: () => ({ data: [] }),
}));
vi.mock("../../api/queries/useNoteQueries", () => ({
  useNote: () => ({ data: undefined }),
  useNoteVersion: () => ({ data: undefined }),
}));
vi.mock("../../components/NoteVersionsDrawer", () => ({
  NoteVersionsDrawer: (props: {
    onRestoreVersion: (v: unknown) => Promise<void>;
  }) => {
    drawerCapture.onRestoreVersion = props.onRestoreVersion ?? null;
    return null;
  },
}));

function makeVersion(
  overrides: Partial<NoteVersionSummaryReply> = {},
): NoteVersionSummaryReply {
  return {
    author_id: "u-1",
    created_at: "2026-01-01T00:00:00Z",
    is_snapshot: false,
    note_id: "note-1",
    snapshot_id: "",
    version_id: "v-3",
    version_index: 3,
    ...overrides,
  };
}

function makeNote(
  overrides: Partial<ConstructorParameters<typeof Note>[0]> = {},
) {
  return new Note({
    id: "note-1",
    title: "Historical title",
    content: "Historical body",
    stripped_content: "Historical body",
    author_id: "u-1",
    updated_at: "2026-01-01T00:00:00Z",
    directory_ids: [],
    tag_ids: [],
    ...overrides,
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function routerWrap(pathname: string) {
  const queryClient = makeQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderRestore(noteId: string | undefined, pathname: string) {
  return renderHook(() => useVersionRestore(noteId), {
    wrapper: routerWrap(pathname),
  });
}

beforeEach(() => {
  drawerCapture.onRestoreVersion = null;
  apiCapture.getVersion.mockReset();
  apiCapture.get.mockReset();
  useEditorSettings.setState({ editMode: false, viewMode: "rich" });
  useActiveNoteStore.setState({
    noteId: undefined,
    editor: null,
    ydoc: null,
    title: "",
    sourceMarkdown: "",
    isSaving: false,
    onNoteUpdated: null,
    updateNote: vi.fn() as never,
    registerNote: vi.fn(),
    setEditor: vi.fn(),
    setYDoc: vi.fn(),
    setTitle: vi.fn(),
    setSourceMarkdown: vi.fn(),
    seedSourceMarkdown: vi.fn(),
    setUpdateNoteFn: vi.fn(),
    getContent: () => "",
    setContent: vi.fn(),
    replaceContent: vi.fn(),
    save: vi.fn(),
  });
  useInfoStore.setState({ Message: new SnackbarUpdateImpl("") });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useVersionRestore - read mode", () => {
  it("fetches the version and displays it without saving", async () => {
    apiCapture.getVersion.mockResolvedValue(
      makeNote({ title: "V3 title", content: "V3 body" }),
    );
    const { result } = renderRestore("note-1", "/n/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion({ version_index: 3 }));
    });

    expect(apiCapture.getVersion).toHaveBeenCalledWith("note-1", 3);
    const state = useActiveNoteStore.getState();
    expect(state.setTitle).toHaveBeenCalledWith("V3 title");
    expect(state.replaceContent).toHaveBeenCalledWith("V3 body");
    // Display-only: no save, no update mutation.
    expect(state.save).not.toHaveBeenCalled();
    expect(state.updateNote).not.toHaveBeenCalled();
  });

  it("does not write the note query cache or invalidate the version list", async () => {
    useEditorSettings.setState({ editMode: false });
    apiCapture.getVersion.mockResolvedValue(
      makeNote({ title: "V3 title", content: "V3 body" }),
    );
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const setQueryData = vi.spyOn(queryClient, "setQueryData");

    const { result } = renderHook(() => useVersionRestore("note-1"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/n/note-1"]}>{children}</MemoryRouter>
        </QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.restoreVersion(makeVersion({ version_index: 3 }));
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    // Only the version fetch itself may be cached.
    expect(queryClient.getQueryData(["notes", "note-1"])).toBeUndefined();
  });
});

describe("useVersionRestore - edit mode", () => {
  it("uses the same display-only path in edit mode (live and offline)", async () => {
    useEditorSettings.setState({ editMode: true });
    apiCapture.getVersion.mockResolvedValue(
      makeNote({ title: "V3 title", content: "V3 body" }),
    );
    const { result } = renderRestore("note-1", "/n/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion({ version_index: 3 }));
    });

    expect(apiCapture.getVersion).toHaveBeenCalledWith("note-1", 3);
    const state = useActiveNoteStore.getState();
    expect(state.setTitle).toHaveBeenCalledWith("V3 title");
    expect(state.replaceContent).toHaveBeenCalledWith("V3 body");
    expect(state.save).not.toHaveBeenCalled();
  });
});

describe("useVersionRestore - guards", () => {
  it("refuses when noteId is missing", async () => {
    const { result } = renderRestore(undefined, "/n/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion());
    });

    expect(apiCapture.getVersion).not.toHaveBeenCalled();
    expect(useActiveNoteStore.getState().replaceContent).not.toHaveBeenCalled();
  });

  it("refuses when the fetched version has no content", async () => {
    apiCapture.getVersion.mockResolvedValue(
      makeNote({ content: "", stripped_content: "" }),
    );
    const { result } = renderRestore("note-1", "/n/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion());
    });

    const state = useActiveNoteStore.getState();
    expect(state.replaceContent).not.toHaveBeenCalled();
    expect(state.setTitle).not.toHaveBeenCalled();
  });
});

describe("VersionInfo - drawer wiring smoke test", () => {
  // Tier 2: confirm `VersionInfo` hands the hook's `restoreVersion`
  // through to `NoteVersionsDrawer.onRestoreVersion`.

  it("passes a callable onRestoreVersion to the drawer", () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter initialEntries={["/n/note-1"]}>
          <Routes>
            <Route path="*" element={<VersionInfo noteId="note-1" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(drawerCapture.onRestoreVersion).not.toBeNull();
    expect(typeof drawerCapture.onRestoreVersion).toBe("function");
  });
});
