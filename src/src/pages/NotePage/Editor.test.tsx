// Tier 2 tests for the editor wrappers.
//
// The wrappers (`NoteEditor`, `PublicNoteEditor`) are the
// encapsulation seam of the editor refactor: each one owns exactly
// one collaboration hook and forwards its result to the
// collab-agnostic `NoteEditorCore`. That's the contract we test.
//
// We mock:
//   - `useNoteCollaboration` / `usePublicNoteCollaboration` so we
//     don't open real WebSockets in tests.
//   - `NoteEditorCore` so we don't pull Tiptap / ProseMirror into
//     jsdom (which would require a separate Tier 4 effort).
// The mock for `NoteEditorCore` records its props on a shared array,
// which the tests then assert against.
//
// The test file is opted into jsdom via the directive below. No
// vitest.config.ts is required: by default Vitest uses `node`, and
// we just override it per file. The setup file is imported
// explicitly so each test starts with a clean zustand state.

// @vitest-environment jsdom

// Side-effect import: pulls in @testing-library/jest-dom matchers
// (toBeInTheDocument etc.) and registers the zustand-reset hooks
// that the tests below depend on. The setup file lazy-imports
// every zustand store so it doesn't pull MUI into tests that
// don't need it.
import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Mock } from "vitest";

// Module mocks must be hoisted, so we use vi.hoisted to share the
// recorder array with the factory callbacks.
const recorder = vi.hoisted(() => ({
  coreProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../hooks/useNoteCollaboration", () => ({
  useNoteCollaboration: vi.fn(),
}));
vi.mock("../../hooks/usePublicNoteCollaboration", () => ({
  usePublicNoteCollaboration: vi.fn(),
}));

vi.mock("./NoteEditorCore", () => ({
  NoteEditorCore: (props: Record<string, unknown>) => {
    recorder.coreProps.push(props);
    return (
      <div
        data-testid="core"
        data-has-ydoc={props.ydoc !== null ? "true" : "false"}
        data-has-provider={props.provider !== null ? "true" : "false"}
        data-note-id={String(props.noteId ?? "")}
        data-fetch-error={String(props.fetchError ?? "")}
      />
    );
  },
}));

import { useNoteCollaboration } from "../../hooks/useNoteCollaboration";
import { usePublicNoteCollaboration } from "../../hooks/usePublicNoteCollaboration";
import { NoteEditor, PublicNoteEditor } from "./Editor";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { Note } from "../../api/models/search";

const mockedPrivate = useNoteCollaboration as unknown as Mock;
const mockedPublic = usePublicNoteCollaboration as unknown as Mock;

function makeNote(
  overrides: Partial<ConstructorParameters<typeof Note>[0]> = {},
) {
  return new Note({
    id: "n1",
    title: "Hello",
    content: "Some content",
    stripped_content: "Some content",
    author_id: "u1",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  });
}

function makeCollab(
  overrides: { hasYdoc?: boolean; hasProvider?: boolean } = {},
) {
  const { hasYdoc = true, hasProvider = true } = overrides;
  return {
    ydoc: hasYdoc ? ({ __brand: "Y.Doc" } as unknown) : null,
    provider: hasProvider
      ? ({ __brand: "HocuspocusProvider" } as unknown)
      : null,
    persistence: { __brand: "IndexeddbPersistence" } as unknown,
  };
}

beforeEach(() => {
  recorder.coreProps.length = 0;
  mockedPrivate.mockReset();
  mockedPublic.mockReset();
});

afterEach(() => {
  // The wrapper subscribes to `useEditorSettings` directly via a
  // getState-style call, so it doesn't re-render. We still reset
  // it for cleanliness, but it doesn't matter for these tests.
  useEditorSettings.setState({ editMode: false, viewMode: "rich" });
});

describe("NoteEditor (private collab)", () => {
  it("passes ydoc and provider from useNoteCollaboration to the core", () => {
    const entry = makeCollab();
    mockedPrivate.mockReturnValue(entry);

    render(
      <NoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(recorder.coreProps).toHaveLength(1);
    expect(recorder.coreProps[0].ydoc).toBe(entry.ydoc);
    expect(recorder.coreProps[0].provider).toBe(entry.provider);
  });

  it("passes null ydoc and provider when the hook returns null", () => {
    // Read-mode before the hook has connected, or any other
    // transient state where the cache lookup missed.
    mockedPrivate.mockReturnValue(null);

    render(
      <NoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(recorder.coreProps[0].ydoc).toBeNull();
    expect(recorder.coreProps[0].provider).toBeNull();
  });

  it("passes only the ydoc when the entry is half-built (no provider yet)", () => {
    // The cache can briefly hold a real Y.Doc before the provider
    // attaches. The wrapper must not coerce nulls into a dummy
    // provider — the core owns that fallback.
    const partial = makeCollab({ hasProvider: false });
    mockedPrivate.mockReturnValue(partial);

    render(
      <NoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(recorder.coreProps[0].ydoc).toBe(partial.ydoc);
    expect(recorder.coreProps[0].provider).toBeNull();
  });

  it("calls useNoteCollaboration with the noteId when editMode is on", () => {
    useEditorSettings.setState({ editMode: true });
    mockedPrivate.mockReturnValue(null);

    render(
      <NoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(mockedPrivate).toHaveBeenCalledWith("n1");
  });

  it("calls useNoteCollaboration with undefined when editMode is off", () => {
    // This is the read-mode guard: when not editing, we must NOT
    // hand the hook a real noteId, or it will open a WebSocket.
    useEditorSettings.setState({ editMode: false });
    mockedPrivate.mockReturnValue(null);

    render(
      <NoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(mockedPrivate).toHaveBeenCalledWith(undefined);
  });

  it("does not call usePublicNoteCollaboration at all", () => {
    useEditorSettings.setState({ editMode: true });
    mockedPrivate.mockReturnValue(null);

    render(
      <NoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(mockedPublic).not.toHaveBeenCalled();
  });

  it("forwards note, noteId, fetchError, and onNoteUpdated unchanged", () => {
    mockedPrivate.mockReturnValue(null);
    const onNoteUpdated = vi.fn();
    const note = makeNote({ title: "Pinned" });

    render(
      <NoteEditor
        note={note}
        noteId="n1"
        fetchError="boom"
        onNoteUpdated={onNoteUpdated}
      />,
    );

    expect(recorder.coreProps[0].note).toBe(note);
    expect(recorder.coreProps[0].noteId).toBe("n1");
    expect(recorder.coreProps[0].fetchError).toBe("boom");
    expect(recorder.coreProps[0].onNoteUpdated).toBe(onNoteUpdated);
  });
});

describe("PublicNoteEditor (public collab)", () => {
  it("uses usePublicNoteCollaboration, not the private one", () => {
    useEditorSettings.setState({ editMode: true });
    mockedPublic.mockReturnValue(null);

    render(
      <PublicNoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(mockedPublic).toHaveBeenCalled();
    expect(mockedPrivate).not.toHaveBeenCalled();
  });

  it("passes ydoc and provider from the public hook to the core", () => {
    const entry = makeCollab();
    mockedPublic.mockReturnValue(entry);

    render(
      <PublicNoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(recorder.coreProps[0].ydoc).toBe(entry.ydoc);
    expect(recorder.coreProps[0].provider).toBe(entry.provider);
  });

  it("calls usePublicNoteCollaboration with the noteId when editMode is on", () => {
    useEditorSettings.setState({ editMode: true });
    mockedPublic.mockReturnValue(null);

    render(
      <PublicNoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(mockedPublic).toHaveBeenCalledWith("n1");
  });

  it("calls usePublicNoteCollaboration with undefined when editMode is off", () => {
    useEditorSettings.setState({ editMode: false });
    mockedPublic.mockReturnValue(null);

    render(
      <PublicNoteEditor
        note={makeNote()}
        noteId="n1"
        fetchError={null}
        onNoteUpdated={() => {}}
      />,
    );

    expect(mockedPublic).toHaveBeenCalledWith(undefined);
  });
});
