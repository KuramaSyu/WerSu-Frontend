// @vitest-environment jsdom

// The mounted host: global fallback on unwired surfaces, native menu
// preserved in text fields, and the base rows rendering once open.

import "../../test/setup";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isXL: false,
  }),
}));

vi.mock("../../utils/renderShortcut", () => ({
  renderShortcut: (shortcut: string) => <span>{shortcut}</span>,
}));

import { RightClickMenuHost } from "./RightClickMenuHost";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";

beforeEach(() => {
  useRightClickMenuStore.setState({
    isOpen: false,
    position: { x: 0, y: 0 },
    request: null,
    disabledButtons: new Set(),
    directoryDialogRequest: 0,
    directoryDialogPayload: null,
  });
});

describe("RightClickMenuHost", () => {
  it("opens the base menu on a right-click no surface handled", () => {
    render(<RightClickMenuHost />);
    fireEvent.contextMenu(document.body);

    expect(useRightClickMenuStore.getState().isOpen).toBe(true);
    expect(useRightClickMenuStore.getState().request?.buttons).toEqual([
      "copy",
      "paste",
    ]);
  });

  it("leaves text fields to the native menu", () => {
    render(<RightClickMenuHost />);
    const input = document.createElement("input");
    document.body.appendChild(input);

    fireEvent.contextMenu(input);
    expect(useRightClickMenuStore.getState().isOpen).toBe(false);
    input.remove();
  });

  it("renders the rows once the menu is open", () => {
    render(<RightClickMenuHost />);
    fireEvent.contextMenu(document.body);

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Paste")).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", () => {
    render(<RightClickMenuHost />);
    fireEvent.contextMenu(document.body);

    const backdrop = document.querySelector(".MuiBackdrop-root");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(useRightClickMenuStore.getState().isOpen).toBe(false);
  });

  it("repositions instead of leaving a stale menu on a second right-click", () => {
    render(<RightClickMenuHost />);
    fireEvent.contextMenu(document.body, { clientX: 10, clientY: 20 });
    fireEvent.contextMenu(document.body, { clientX: 300, clientY: 400 });

    expect(useRightClickMenuStore.getState().position).toEqual({
      x: 300,
      y: 400,
    });
  });
});
