// @vitest-environment jsdom

import "../../../test/setup";

import { fireEvent, render, screen } from "@testing-library/react";
import type {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RestNotesSearchType } from "../../../api/models/search";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import { SearchOverlayHeader } from "./SearchOverlayHeader";

// `@mui/material` is mocked wholesale: the real package drags in
// transition/portal machinery that the Vitest ESM resolver can't
// load. Each stand-in only renders what `SearchOverlayHeader` and
// `SearchCommandSuggestions` actually use.
vi.mock("@mui/material", () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  InputAdornment: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  TextField: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    inputRef,
  }: {
    value?: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    inputRef?: Ref<HTMLInputElement>;
  }) => (
    <input
      ref={inputRef}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  ),
  Paper: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  List: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
  ListItemButton: ({
    children,
    onClick,
    onMouseEnter,
    onMouseDown,
    selected,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
    selected?: boolean;
  }) => (
    <li>
      <button
        type="button"
        data-selected={selected ? "yes" : "no"}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseDown={onMouseDown}
      >
        {children}
      </button>
    </li>
  ),
  ListItemText: ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => (
    <span>
      {primary}
      {secondary ? <small>{secondary}</small> : null}
    </span>
  ),
  Typography: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@mui/material/styles", () => ({
  alpha: (color: string) => color,
}));

vi.mock("@mui/icons-material/Search", () => ({
  default: () => <span />,
}));

// These siblings pull in their own heavy dependency graphs; the
// header's command behavior doesn't depend on them.
vi.mock("../../SearchStrategySelect", () => ({
  default: () => null,
}));

vi.mock("./SearchTypeOverrideHint", () => ({
  SearchTypeOverrideHint: () => null,
}));

const getInput = () =>
  screen.getByPlaceholderText(/type "\/"/) as HTMLInputElement;

const renderHeader = () =>
  render(<SearchOverlayHeader onClose={() => undefined} />);

beforeEach(() => {
  useSearchFilterStore.setState({
    search: "",
    debouncedSearch: "",
    searchType: RestNotesSearchType.KEYWORD,
    filter: { selectedDirs: [], mode: "all", scope: "direct" },
  });
});

describe("SearchOverlayHeader slash commands", () => {
  it("opens a suggestion list when the input starts with a slash", () => {
    renderHeader();
    fireEvent.change(getInput(), { target: { value: "/" } });

    expect(screen.getByRole("button", { name: /\/mode/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\/context/ }),
    ).toBeInTheDocument();
  });

  it("shows no suggestions for a plain search query", () => {
    renderHeader();
    fireEvent.change(getInput(), { target: { value: "hello world" } });

    expect(
      screen.queryByRole("button", { name: /\/mode/ }),
    ).not.toBeInTheDocument();
  });

  it("Tab-completes the top suggestion", () => {
    renderHeader();
    const input = getInput();
    fireEvent.change(input, { target: { value: "/co" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(input.value).toBe("/context");
  });

  it("completes the bare /mode command and waits for its argument", () => {
    renderHeader();
    const input = getInput();
    fireEvent.change(input, { target: { value: "/mode" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("/mode ");
    // Nothing applied yet - still the previous strategy.
    expect(useSearchFilterStore.getState().searchType).toBe(
      RestNotesSearchType.KEYWORD,
    );
    expect(useSearchFilterStore.getState().search).toBe("/mode ");
  });

  it("Enter on /context applies the mode and clears the input", () => {
    renderHeader();
    const input = getInput();
    fireEvent.change(input, { target: { value: "/context" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useSearchFilterStore.getState().searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
    expect(useSearchFilterStore.getState().search).toBe("");
  });

  it("Enter on /mode context applies the mode and clears the input", () => {
    renderHeader();
    const input = getInput();
    fireEvent.change(input, { target: { value: "/mode context" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useSearchFilterStore.getState().searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
    expect(useSearchFilterStore.getState().search).toBe("");
  });

  it("arrow keys move the highlight before Enter picks it", () => {
    renderHeader();
    const input = getInput();
    // "/" lists mode, context, keyword, fuzzy in declaration order.
    fireEvent.change(input, { target: { value: "/" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useSearchFilterStore.getState().searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
    expect(useSearchFilterStore.getState().search).toBe("");
  });

  it("stops the command Enter from reaching the document (results nav)", () => {
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);
    try {
      renderHeader();
      const input = getInput();
      fireEvent.change(input, { target: { value: "/context" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useSearchFilterStore.getState().searchType).toBe(
        RestNotesSearchType.CONTEXT,
      );
      // The results list listens on `document`; the command must not
      // let the keystroke bubble or it would open a note.
      expect(onDocumentKeyDown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", onDocumentKeyDown);
    }
  });

  it("stops command arrow navigation from reaching the document", () => {
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);
    try {
      renderHeader();
      const input = getInput();
      fireEvent.change(input, { target: { value: "/" } });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      expect(onDocumentKeyDown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", onDocumentKeyDown);
    }
  });

  it("Escape dismisses only the command menu, not the overlay", () => {
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);
    try {
      renderHeader();
      const input = getInput();
      fireEvent.change(input, { target: { value: "/" } });
      expect(
        screen.getByRole("button", { name: /\/mode/ }),
      ).toBeInTheDocument();

      fireEvent.keyDown(input, { key: "Escape" });

      // Menu gone, text kept, and the overlay's document-level ESC
      // handler never saw the key.
      expect(
        screen.queryByRole("button", { name: /\/mode/ }),
      ).not.toBeInTheDocument();
      expect(input.value).toBe("/");
      expect(onDocumentKeyDown).not.toHaveBeenCalled();

      // Typing again brings the menu back.
      fireEvent.change(input, { target: { value: "/c" } });
      expect(
        screen.getByRole("button", { name: /\/context/ }),
      ).toBeInTheDocument();
    } finally {
      document.removeEventListener("keydown", onDocumentKeyDown);
    }
  });

  it("falls back to the typed command when the list has filtered out", () => {
    renderHeader();
    const input = getInput();
    fireEvent.change(input, { target: { value: "/fuzzy anything" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useSearchFilterStore.getState().searchType).toBe(
      RestNotesSearchType.TYPO_TOLERANT,
    );
    expect(useSearchFilterStore.getState().search).toBe("");
  });
});
