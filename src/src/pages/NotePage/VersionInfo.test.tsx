// Tier 1 tests for `useVersionRestore`. Plus a Tier 2 smoke
// test confirming `VersionInfo` wires the drawer's `onRestoreVersion`
// to the hook.
//
// Restore flow:
//   - edit mode: rebuilds the collab session (private or public
//     depending on the route), then mirrors the historical title/
//     content into the editor store.
//   - view mode: skips the collab rebuild and only mirrors the
//     historical title/content into the editor store.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { useVersionRestore } from "./VersionInfo.hooks";
import { VersionInfo } from "./VersionInfo";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { Note } from "../../api/models/search";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

const rehydrateSpy = vi.fn();
const rehydratePublicSpy = vi.fn();
const drawerCapture = vi.hoisted(() => ({
  onRestoreVersion: null as null | ((v: unknown, n: unknown) => Promise<void>),
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

vi.mock("../../hooks/useNoteCollaboration", () => ({
  rehydrateCollabSession: (...args: unknown[]) => {
    rehydrateSpy(...args);
    return Promise.resolve();
  },
}));
vi.mock("../../hooks/usePublicNoteCollaboration", () => ({
  rehydratePublicCollabSession: (...args: unknown[]) => {
    rehydratePublicSpy(...args);
    return Promise.resolve();
  },
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
    onRestoreVersion: (v: unknown, n: unknown) => Promise<void>;
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

function routerWrap(pathname: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );
}

function renderRestore(noteId: string | undefined, pathname: string) {
  return renderHook(() => useVersionRestore(noteId), {
    wrapper: routerWrap(pathname),
  });
}

beforeEach(() => {
  rehydrateSpy.mockReset();
  rehydratePublicSpy.mockReset();
  drawerCapture.onRestoreVersion = null;
  useEditorSettings.setState({ editMode: false, viewMode: "rich" });
  useActiveNoteStore.setState({
    noteId: undefined,
    editor: null,
    ydoc: null,
    title: "",
    sourceMarkdown: "",
    isSaving: false,
    onNoteUpdated: null,
    updateNote: (() => {
      throw new Error("updateNote not set");
    }) as never,
    registerNote: vi.fn(),
    setEditor: vi.fn(),
    setYDoc: vi.fn(),
    setTitle: vi.fn(),
    setSourceMarkdown: vi.fn(),
    setUpdateNoteFn: vi.fn(),
    getContent: () => "",
    setContent: vi.fn(),
    save: vi.fn(),
  });
  useInfoStore.setState({ Message: new SnackbarUpdateImpl("") });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useVersionRestore - view mode", () => {
  it("does not rebuild the private collab session", async () => {
    const { result } = renderRestore("note-1", "/n/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion(), makeNote());
    });

    expect(rehydrateSpy).not.toHaveBeenCalled();
  });

  it("does not rebuild the public collab session", async () => {
    const { result } = renderRestore("note-1", "/public/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion(), makeNote());
    });

    expect(rehydratePublicSpy).not.toHaveBeenCalled();
  });

  it("mirrors the historical title and content into the editor store", async () => {
    const { result } = renderRestore("note-1", "/n/note-1");
    const note = makeNote({ title: "V3 title", content: "V3 body" });

    await act(async () => {
      await result.current.restoreVersion(
        makeVersion({ version_index: 3 }),
        note,
      );
    });

    const setTitle = useActiveNoteStore.getState().setTitle;
    const setContent = useActiveNoteStore.getState().setContent;
    expect(setTitle).toHaveBeenCalledWith("V3 title");
    expect(setContent).toHaveBeenCalledWith("V3 body");
  });
});

describe("useVersionRestore - edit mode", () => {
  it("rebuilds the private collab session before mirroring content", async () => {
    useEditorSettings.setState({ editMode: true });
    const { result } = renderRestore("note-1", "/n/note-1");
    const note = makeNote();

    await act(async () => {
      await result.current.restoreVersion(makeVersion(), note);
    });

    expect(rehydrateSpy).toHaveBeenCalledTimes(1);
    expect(rehydrateSpy).toHaveBeenCalledWith("note-1", note.content);
    const setContent = useActiveNoteStore.getState().setContent;
    expect(setContent).toHaveBeenCalledWith(note.content);
  });

  it("rebuilds the public collab session before mirroring content", async () => {
    useEditorSettings.setState({ editMode: true });
    const { result } = renderRestore("note-1", "/public/note-1");
    const note = makeNote();

    await act(async () => {
      await result.current.restoreVersion(makeVersion(), note);
    });

    expect(rehydratePublicSpy).toHaveBeenCalledTimes(1);
  });
});

describe("useVersionRestore - guards", () => {
  it("refuses when noteId is missing", async () => {
    const { result } = renderRestore(undefined, "/n/note-1");

    await act(async () => {
      await result.current.restoreVersion(makeVersion(), makeNote());
    });

    expect(rehydrateSpy).not.toHaveBeenCalled();
  });

  it("refuses when versioned note data is incomplete", async () => {
    const { result } = renderRestore("note-1", "/n/note-1");
    const note = makeNote({ content: "" });

    await act(async () => {
      await result.current.restoreVersion(makeVersion(), note);
    });

    const setContent = useActiveNoteStore.getState().setContent;
    expect(setContent).not.toHaveBeenCalled();
    expect(rehydrateSpy).not.toHaveBeenCalled();
  });
});

describe("VersionInfo - drawer wiring smoke test", () => {
  // Tier 2: confirm `VersionInfo` hands the hook's `restoreVersion`
  // through to `NoteVersionsDrawer.onRestoreVersion`.

  it("passes a callable onRestoreVersion to the drawer", () => {
    render(
      <MemoryRouter initialEntries={["/n/note-1"]}>
        <Routes>
          <Route path="*" element={<VersionInfo noteId="note-1" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(drawerCapture.onRestoreVersion).not.toBeNull();
    expect(typeof drawerCapture.onRestoreVersion).toBe("function");
  });
});
