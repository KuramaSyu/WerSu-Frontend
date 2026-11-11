// @vitest-environment jsdom

// Regression test for the "Enter in the note editor jumps to a search
// result" bug.
//
// The results list owns a document-level keydown listener (arrow keys /
// Enter). On mobile the search drawer stays mounted after its first
// open, so an ungated listener kept handling Enter everywhere in the
// app: typing a newline at the end of a note activated the previously
// selected result and navigated to another note. The listener must only
// run while the overlay is actually open.

import "../../../test/setup";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Note } from "../../../api/models/search";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import { useSearchNotesStore } from "../../../zustand/useSearchNotesStore";

// The real MUI bundle pulls in transition/portal machinery the Vitest ESM
// resolver can't load; the list only uses Box/Stack, so stub them.
vi.mock("@mui/material", () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

// Keep the row / empty / sentinel subtrees out of the test: this test only
// exercises the document-level keyboard handler.
vi.mock("./SearchResultRow", () => ({ default: () => null }));
vi.mock("./SearchResultsEmptyState", () => ({ default: () => null }));
vi.mock("./InfiniteScrollSentinel", () => ({ default: () => null }));

vi.mock("../../../zustand/useThemeStore", () => ({
  useThemeStore: (selector: (state: { theme: unknown }) => unknown) =>
    selector({ theme: {} }),
}));

vi.mock("../../../api/queries/directoryQueries", () => ({
  useAllDirectoriesQuery: () => ({ byId: {} }),
}));

const searchResults = vi.hoisted(() => ({ notes: [] as unknown[] }));
vi.mock("./SearchResultsList.hook", () => ({
  useSearchResults: () => ({
    notes: searchResults.notes,
    isInitialLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: () => undefined,
  }),
}));

import { SearchResultsList } from "./SearchResultsList";

const makeNote = () =>
  new Note({
    id: "n-target",
    title: "Target note",
    content: "hello",
    stripped_content: "hello",
    author_id: "u1",
    updated_at: "2024-01-01T00:00:00Z",
    directory_ids: [],
    tag_ids: [],
  });

function PathProbe() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

const renderList = () =>
  render(
    <MemoryRouter initialEntries={["/n/current"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <PathProbe />
              <SearchResultsList />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("SearchResultsList document Enter handler", () => {
  it("ignores Enter while the overlay is closed", () => {
    searchResults.notes = [makeNote()];
    useSearchNotesStore.setState({ isDialogOpen: false });

    renderList();

    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });

    expect(screen.getByTestId("path")).toHaveTextContent("/n/current");
  });

  it("activates the selected result on Enter while the overlay is open", () => {
    searchResults.notes = [makeNote()];
    useSearchNotesStore.setState({ isDialogOpen: true });

    renderList();

    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });

    expect(screen.getByTestId("path")).toHaveTextContent("/n/n-target");
  });

  it("detaches the listener again when the overlay closes", () => {
    searchResults.notes = [makeNote()];
    useSearchNotesStore.setState({ isDialogOpen: true });

    renderList();

    act(() => {
      useSearchNotesStore.setState({ isDialogOpen: false });
    });

    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });

    expect(screen.getByTestId("path")).toHaveTextContent("/n/current");
  });

  it("keeps the query intact after a closed-overlay Enter", () => {
    searchResults.notes = [makeNote()];
    useSearchNotesStore.setState({ isDialogOpen: false });
    useSearchFilterStore.getState().setSearch("keep me");

    renderList();

    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });

    expect(useSearchFilterStore.getState().search).toBe("keep me");
  });
});
