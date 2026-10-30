// @vitest-environment jsdom

// The editor controller: installs a stable opener ref, and invoking
// it opens the store with the editor request built from the selection.

import "../../test/setup";

import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isXL: false,
  }),
}));

vi.mock("../Editor/bubbleMenuStrategies", () => ({
  analyseSelection: () => ({ kind: "text", editable: true, state: {} }),
  clearCells: vi.fn(),
}));

import {
  EditorRightClickMenu,
  type EditorContextMenuOpener,
} from "./EditorRightClickMenu";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";

const editor = { state: {} } as never;

describe("EditorRightClickMenu", () => {
  it("installs the opener and opens the menu on contextmenu", async () => {
    const openerRef: { current: EditorContextMenuOpener | null } = {
      current: null,
    };
    render(
      <EditorRightClickMenu
        editor={editor}
        editMode
        openerRef={openerRef}
      />,
    );

    await waitFor(() => expect(openerRef.current).toBeTypeOf("function"));

    act(() => {
      openerRef.current?.(new MouseEvent("contextmenu", { clientX: 5, clientY: 6 }));
    });

    const request = useRightClickMenuStore.getState().request;
    expect(useRightClickMenuStore.getState().isOpen).toBe(true);
    expect(request?.buttons).toEqual([
      "copy",
      "paste",
      "cut",
      "insert",
    ]);
  });
});
