// @vitest-environment jsdom

// The editor controller: installs a stable opener ref, resolves the
// clicked element, and opens the store with the matching request.

import "../../test/setup";

import { act, render, waitFor } from "@testing-library/react";
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
  analyseSelection: vi.fn(() => ({
    kind: "text",
    editable: true,
    state: {},
  })),
  resolveEditorContextTarget: vi.fn(() => null),
}));

vi.mock("../Editor/bubbleMenuStrategies", () => ({
  analyseSelection: mocks.analyseSelection,
}));

vi.mock("../Editor/editorContextTarget", () => ({
  resolveEditorContextTarget: mocks.resolveEditorContextTarget,
  applyEditorContextTarget: vi.fn(),
}));

vi.mock("../Editor/editorContextHighlight", () => ({
  setEditorContextHighlight: vi.fn(),
  clearEditorContextHighlight: vi.fn(),
}));

import {
  EditorRightClickMenu,
  type EditorContextMenuOpener,
} from "./EditorRightClickMenu";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";

const editor = {
  state: {},
  view: { dom: document.createElement("div") },
  isDestroyed: false,
  on: vi.fn(),
  off: vi.fn(),
} as never;

function renderOpener() {
  const openerRef: { current: EditorContextMenuOpener | null } = {
    current: null,
  };
  render(
    <EditorRightClickMenu editor={editor} editMode openerRef={openerRef} />,
  );
  return openerRef;
}

function fireContextMenu(openerRef: { current: EditorContextMenuOpener | null }) {
  act(() => {
    openerRef.current?.(
      new MouseEvent("contextmenu", { clientX: 5, clientY: 6 }),
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.analyseSelection.mockReturnValue({
    kind: "text",
    editable: true,
    state: {},
  });
  mocks.resolveEditorContextTarget.mockReturnValue(null);
  useRightClickMenuStore.setState({
    isOpen: false,
    request: null,
    disabledButtons: new Set(),
  });
});

describe("EditorRightClickMenu", () => {
  it("installs the opener and opens the base menu on contextmenu", async () => {
    const openerRef = renderOpener();
    await waitFor(() => expect(openerRef.current).toBeTypeOf("function"));

    fireContextMenu(openerRef);

    const request = useRightClickMenuStore.getState().request;
    expect(useRightClickMenuStore.getState().isOpen).toBe(true);
    expect(request?.buttons).toEqual(["copy", "paste", "cut", "insert"]);
  });

  it("adds table rows when the click lands in a table", async () => {
    mocks.resolveEditorContextTarget.mockReturnValue({
      kind: "table",
      from: 1,
      to: 20,
      hitPos: 4,
    } as never);
    mocks.analyseSelection.mockReturnValue({
      kind: "tableCell",
      editable: true,
      state: {},
      cell: { rowIndices: [0], columnIndices: [0] },
    } as never);

    const openerRef = renderOpener();
    await waitFor(() => expect(openerRef.current).toBeTypeOf("function"));
    fireContextMenu(openerRef);

    const request = useRightClickMenuStore.getState().request;
    expect(request?.leadingComponents?.map((row) => row.key)).toEqual([
      "delete-table",
      "table-rows",
      "table-columns",
      "clear-cells",
    ]);
  });

  it("waits for the create event when the view is not mounted yet", async () => {
    const dom = document.createElement("div");
    const listeners: Record<string, () => void> = {};
    const lateEditor = {
      isDestroyed: false,
      get view(): { dom: HTMLElement } {
        throw new Error("The editor view is not available");
      },
      on: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
      off: vi.fn(),
    };

    const openerRef: { current: EditorContextMenuOpener | null } = {
      current: null,
    };
    render(
      <EditorRightClickMenu
        editor={lateEditor as never}
        editMode
        openerRef={openerRef}
      />,
    );

    // Still not mounted, so attach did not throw into React.
    expect(openerRef.current).toBeNull();

    Object.defineProperty(lateEditor, "view", {
      value: { dom },
      configurable: true,
    });
    act(() => listeners.create?.());

    await act(async () => {
      dom.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(useRightClickMenuStore.getState().isOpen).toBe(true);
  });

  it("attaches a capture listener that opens the menu from the DOM", async () => {
    const openerRef = renderOpener();
    await waitFor(() => expect(openerRef.current).toBeTypeOf("function"));

    const dom = (editor as unknown as { view: { dom: HTMLElement } }).view
      .dom;
    await act(async () => {
      dom.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 7,
          clientY: 8,
        }),
      );
    });

    expect(useRightClickMenuStore.getState().isOpen).toBe(true);
  });

  it("appends element rows for an image target", async () => {
    mocks.resolveEditorContextTarget.mockReturnValue({
      kind: "image",
      from: 1,
      to: 2,
      hitPos: 1,
      node: { attrs: { src: "http://img" } },
    } as never);

    const openerRef = renderOpener();
    await waitFor(() => expect(openerRef.current).toBeTypeOf("function"));
    fireContextMenu(openerRef);

    const request = useRightClickMenuStore.getState().request;
    expect(request?.leadingComponents?.map((row) => row.key)).toEqual([
      "image-copy-link",
      "image-delete",
    ]);
  });
});
