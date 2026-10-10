// Tier 2 tests for VersionInfo's restore flow.
//
// The restore flow has two modes:
//   - edit mode: rebuilds the collab session (private or public
//     depending on the route), then mirrors the historical title/
//     content into the editor store so the user can review + save.
//   - view mode: skips the collab rebuild entirely (no session is
//     open in read mode -- Editor.tsx gates useNoteCollaboration
//     on editMode), and just mirrors the historical title/content
//     into the editor store so the user can preview the version
//     without any side effects.
//
// We render `VersionInfo` in jsdom; the heavy MUI imports are
// stubbed so the suite stays fast. The tests capture the
// `onRestoreVersion` callback that `VersionInfo` hands to the
// drawer, then invoke it directly with a synthetic version + note.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  handleRestoreVersion: null as null | ((v: unknown, n: unknown) => Promise<void>),
}));

// Stub MUI/transitive ESM packages that pull react-transition-group /
// material-color-utilities in a way Vite's ESM resolver rejects. Each
// stub keeps the named exports the component under test consumes
// and nothing more.
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
  PanelSection: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("./CollabStatusBadge", () => ({
  CollabStatusBadge: () => null,
}));

const rehydrateSpy = vi.fn();
const rehydratePublicSpy = vi.fn();

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

vi.mock("../../components/NoteVersionsDrawer", () => ({
  NoteVersionsDrawer: (props: { onRestoreVersion: (v: unknown, n: unknown) => Promise<void> }) => {
    captured.handleRestoreVersion = props.onRestoreVersion ?? null;
    return null;
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
  useUpdateNote: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../hooks/useNoteCollaboration", () => ({
  rehydrateCollabSession: (...args: unknown[]) => {
    rehydrateSpy(...args);
    return Promise.resolve();
  },
}));

import { render } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { Note } from "../../api/models/search";
import { VersionInfo } from "./VersionInfo";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";

function makeVersion(overrides: Partial<NoteVersionSummaryReply> = {}): NoteVersionSummaryReply {
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

function makeNote(overrides: Partial<ConstructorParameters<typeof Note>[0]> = {}) {
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

beforeEach(() => {
  captured.handleRestoreVersion = null;
  rehydrateSpy.mockReset();
  rehydratePublicSpy.mockReset();
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderInfo(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<VersionInfo noteId="note-1" />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function invokeRestore(version: NoteVersionSummaryReply, note: Note) {
  if (!captured.handleRestoreVersion) {
    throw new Error("drawer did not receive onRestoreVersion");
  }
  await captured.handleRestoreVersion(version, note);
}

describe("VersionInfo.restore - view mode", () => {
  it("does not rebuild the private collab session", async () => {
    useEditorSettings.setState({ editMode: false });
    renderInfo("/n/note-1");

    await invokeRestore(makeVersion(), makeNote());

    expect(rehydrateSpy).not.toHaveBeenCalled();
  });

  it("does not rebuild the public collab session", async () => {
    useEditorSettings.setState({ editMode: false });
    renderInfo("/public/note-1");

    await invokeRestore(makeVersion(), makeNote());

    expect(rehydratePublicSpy).not.toHaveBeenCalled();
  });

  it("mirrors the historical title and content into the editor store", async () => {
    useEditorSettings.setState({ editMode: false });
    renderInfo("/n/note-1");

    const note = makeNote({ title: "V3 title", content: "V3 body" });
    await invokeRestore(makeVersion({ version_index: 3 }), note);

    const setTitle = useActiveNoteStore.getState().setTitle as ReturnType<typeof vi.fn>;
    const setContent = useActiveNoteStore.getState().setContent as ReturnType<typeof vi.fn>;
    expect(setTitle).toHaveBeenCalledWith("V3 title");
    expect(setContent).toHaveBeenCalledWith("V3 body");
  });
});

describe("VersionInfo.restore - edit mode", () => {
  it("rebuilds the private collab session before mirroring content", async () => {
    useEditorSettings.setState({ editMode: true });
    renderInfo("/n/note-1");

    const note = makeNote();
    await invokeRestore(makeVersion(), note);

    expect(rehydrateSpy).toHaveBeenCalledTimes(1);
    expect(rehydrateSpy).toHaveBeenCalledWith("note-1", note.content);
    const setContent = useActiveNoteStore.getState().setContent as ReturnType<typeof vi.fn>;
    expect(setContent).toHaveBeenCalledWith(note.content);
  });

  it("rebuilds the public collab session before mirroring content", async () => {
    useEditorSettings.setState({ editMode: true });
    renderInfo("/public/note-1");

    const note = makeNote();
    await invokeRestore(makeVersion(), note);

    expect(rehydratePublicSpy).toHaveBeenCalledTimes(1);
  });
});

describe("VersionInfo.restore - guards", () => {
  it("refuses when noteId is missing", async () => {
    useEditorSettings.setState({ editMode: false });
    // noteId undefined -> early return
    render(
      <MemoryRouter initialEntries={["/n/note-1"]}>
        <Routes>
          <Route path="*" element={<VersionInfo noteId={undefined} />} />
        </Routes>
      </MemoryRouter>,
    );
    await invokeRestore(makeVersion(), makeNote());
    expect(rehydrateSpy).not.toHaveBeenCalled();
  });

  it("refuses when versioned note data is incomplete", async () => {
    useEditorSettings.setState({ editMode: false });
    renderInfo("/n/note-1");

    const note = makeNote({ content: "" });
    await invokeRestore(makeVersion(), note);

    const setContent = useActiveNoteStore.getState().setContent as ReturnType<typeof vi.fn>;
    expect(setContent).not.toHaveBeenCalled();
    expect(rehydrateSpy).not.toHaveBeenCalled();
  });
});
