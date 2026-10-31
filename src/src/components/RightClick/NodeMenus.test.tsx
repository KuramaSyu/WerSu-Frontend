// @vitest-environment jsdom

// Surface menus: request shape, delete gating through the
// confirmation dialog, root protection, and favourite/edit/rename
// routing.

import "../../test/setup";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isXL: false,
  }),
}));

const mocks = vi.hoisted(() => ({
  deleteNote: vi.fn(async () => undefined),
  renameNote: vi.fn(async () => ({})),
  deleteDirectory: vi.fn(async () => true),
}));

vi.mock("../../api/queries/useNoteQueries", () => ({
  useDeleteNote: () => ({ mutateAsync: mocks.deleteNote }),
  useUpdateNote: () => ({ mutateAsync: mocks.renameNote, isPending: false }),
}));

vi.mock("../../api/queries/useDirectoryMutations", () => ({
  useDirectoryDelete: () => mocks.deleteDirectory,
}));

import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { NoteCardMenu } from "./NoteCardMenu";
import { FolderCardMenu } from "./FolderCardMenu";
import { DirectoryItemMenu } from "./DirectoryItemMenu";
import type { MinimalNote } from "../../api/models/search";

const note = {
  id: "n1",
  title: "Hello world",
  stripped_content: "",
  updated_at: new Date().toISOString(),
} as MinimalNote;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );

const openMenu = (label: string) => {
  fireEvent.contextMenu(screen.getByText(label));
  return useRightClickMenuStore.getState().request;
};

beforeEach(() => {
  vi.clearAllMocks();
  useRightClickMenuStore.setState({
    isOpen: false,
    position: { x: 0, y: 0 },
    request: null,
    disabledButtons: new Set(),
    directoryDialogRequest: 0,
    directoryDialogPayload: null,
  });
  useFavouritesStore.setState({ notes: {}, directories: {} });
});

describe("NoteCardMenu", () => {
  it("builds the card spec and opens a context menu", () => {
    renderWithProviders(
      <NoteCardMenu note={note}>
        <div>note-body</div>
      </NoteCardMenu>,
    );
    const request = openMenu("note-body");

    expect(request?.targetId).toBe("n1");
    expect(request?.buttons).toEqual(["copy", "paste", "edit", "delete"]);
    expect(request?.overrides?.delete?.handler).toBeTypeOf("function");
  });

  it("delete opens the confirmation dialog and only deletes on confirm", async () => {
    renderWithProviders(
      <NoteCardMenu note={note}>
        <div>note-body</div>
      </NoteCardMenu>,
    );
    const request = openMenu("note-body");

    act(() => {
      request?.overrides?.delete?.handler?.(undefined);
    });
    expect(await screen.findByText("Delete this note?")).toBeInTheDocument();
    expect(mocks.deleteNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mocks.deleteNote).toHaveBeenCalledWith("n1"),
    );
  });

  it("edit opens the rename dialog", async () => {
    renderWithProviders(
      <NoteCardMenu note={note}>
        <div>note-body</div>
      </NoteCardMenu>,
    );
    const request = openMenu("note-body");

    act(() => {
      request?.overrides?.edit?.handler?.(undefined);
    });
    expect(await screen.findByText("Rename note")).toBeInTheDocument();
  });
});

describe("FolderCardMenu", () => {
  it("favourite flips the directory in the favourites store", () => {
    renderWithProviders(
      <FolderCardMenu directoryId="d1" name="Folder">
        <div>folder-body</div>
      </FolderCardMenu>,
    );
    const request = openMenu("folder-body");

    expect(request?.buttons).toEqual([
      "copy",
      "paste",
      "favourite",
      "edit",
      "delete",
    ]);
    act(() => {
      request?.overrides?.favourite?.handler?.(undefined);
    });
    expect(useFavouritesStore.getState().directories.d1).toBe(true);
  });

  it("edit routes through the shared directory dialog", () => {
    renderWithProviders(
      <FolderCardMenu directoryId="d1" name="Folder">
        <div>folder-body</div>
      </FolderCardMenu>,
    );
    const request = openMenu("folder-body");

    act(() => {
      request?.overrides?.edit?.handler?.(undefined);
    });
    expect(useRightClickMenuStore.getState().directoryDialogPayload).toEqual({
      mode: "edit",
      directoryId: "d1",
    });
  });
});

describe("DirectoryItemMenu", () => {
  it("disables edit and delete for the root directory", () => {
    renderWithProviders(
      <DirectoryItemMenu
        target={{
          kind: "directory",
          directoryId: "root",
          name: "Stacks",
          isRoot: true,
        }}
      >
        <div>root-row</div>
      </DirectoryItemMenu>,
    );
    const request = openMenu("root-row");

    expect(request?.buttons).toEqual(["copy", "paste", "edit", "delete"]);
    expect(request?.overrides?.edit).toBeUndefined();
    expect(request?.overrides?.delete).toBeUndefined();
  });

  it("opens edit for a non-root directory and deletes on confirm", async () => {
    renderWithProviders(
      <DirectoryItemMenu
        target={{
          kind: "directory",
          directoryId: "d1",
          name: "Folder",
          isRoot: false,
        }}
      >
        <div>dir-row</div>
      </DirectoryItemMenu>,
    );
    const request = openMenu("dir-row");

    act(() => {
      request?.overrides?.edit?.handler?.(undefined);
    });
    expect(useRightClickMenuStore.getState().directoryDialogPayload).toEqual({
      mode: "edit",
      directoryId: "d1",
    });

    act(() => {
      request?.overrides?.delete?.handler?.(undefined);
    });
    expect(
      await screen.findByText("Delete this directory?"),
    ).toBeInTheDocument();
    expect(mocks.deleteDirectory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mocks.deleteDirectory).toHaveBeenCalledWith("d1"),
    );
  });

  it("offers rename for a note row and opens the rename dialog", async () => {
    renderWithProviders(
      <DirectoryItemMenu
        target={{ kind: "note", noteId: "n1", title: "Hello world" }}
      >
        <div>note-row</div>
      </DirectoryItemMenu>,
    );
    const request = openMenu("note-row");

    expect(request?.buttons).toEqual([
      "copy",
      "paste",
      "edit",
      "rename",
      "delete",
    ]);
    expect(request?.overrides?.rename?.handler).toBeTypeOf("function");

    act(() => {
      request?.overrides?.rename?.handler?.(undefined);
    });
    expect(await screen.findByText("Rename note")).toBeInTheDocument();
  });
});
