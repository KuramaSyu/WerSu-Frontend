// @vitest-environment jsdom

// Editor presets: request shape per mode, table detection plus
// singular/plural labels, and the insert submenu actions.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyseSelection: vi.fn(),
  clearCells: vi.fn(),
}));

vi.mock("../Editor/bubbleMenuStrategies", () => ({
  analyseSelection: mocks.analyseSelection,
  clearCells: mocks.clearCells,
}));

import {
  buildEditorMenuRequest,
  buildInsertSubmenu,
  buildTableSubmenu,
} from "./rightClickMenuPresets";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import type {
  CellContext,
  SelectionAnalysisFull,
} from "../Editor/bubbleMenuStrategies";

/** Chain mock: every command returns the chain, run() returns true. */
function makeChain() {
  const run = vi.fn(() => true);
  const chain: Record<string, unknown> = { run };
  for (const method of [
    "focus",
    "insertTable",
    "setCodeBlock",
    "addRowBefore",
    "addRowAfter",
    "addColumnBefore",
    "addColumnAfter",
    "deleteRow",
    "deleteColumn",
    "deleteTable",
  ]) {
    chain[method] = vi.fn(() => chain);
  }
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    run: ReturnType<typeof vi.fn>;
  };
}

function makeEditor() {
  const chain = makeChain();
  return { chain, editor: { chain: vi.fn(() => chain), state: {} } };
}

function analysis(
  overrides: Partial<SelectionAnalysisFull> = {},
): SelectionAnalysisFull {
  return {
    kind: "text",
    editable: true,
    state: {} as SelectionAnalysisFull["state"],
    ...overrides,
  };
}

function cell(rowIndices: number[], columnIndices: number[]): CellContext {
  return { rowIndices, columnIndices } as CellContext;
}

const position = { x: 10, y: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.analyseSelection.mockReturnValue(analysis());
  useEditorMenuStore.setState({
    fileDialogRequest: 0,
    latexDialogRequest: 0,
  });
});

describe("buildEditorMenuRequest", () => {
  it("offers copy only in read mode, with no table or insert rows", () => {
    const { editor } = makeEditor();
    const request = buildEditorMenuRequest(editor as never, false, position);

    expect(request.buttons).toEqual(["copy", "paste"]);
    expect(request.submenus).toBeUndefined();
    expect(request.overrides).toBeUndefined();
  });

  it("adds cut and insert outside a table in edit mode", () => {
    const { editor } = makeEditor();
    const request = buildEditorMenuRequest(editor as never, true, position);

    expect(request.buttons).toEqual(["copy", "paste", "cut", "insert"]);
    expect(request.submenus?.insert).toBeDefined();
    expect(request.submenus?.table).toBeUndefined();
    expect(request.overrides?.insert?.handler).toBeTypeOf("function");
  });

  it("adds the table trigger when the click lands in a table", () => {
    mocks.analyseSelection.mockReturnValue(
      analysis({ kind: "tableCell", cell: cell([1], [2]) }),
    );
    const { editor } = makeEditor();
    const request = buildEditorMenuRequest(editor as never, true, position);

    expect(request.buttons).toEqual([
      "copy",
      "paste",
      "cut",
      "insert",
      "table",
    ]);
    expect(request.submenus?.table).toBeDefined();
    expect(request.overrides?.table?.handler).toBeTypeOf("function");
  });
});

describe("buildTableSubmenu", () => {
  it("returns null when the selection is not in a table", () => {
    const { editor } = makeEditor();
    expect(buildTableSubmenu(editor as never, analysis())).toBeNull();
  });

  it("uses singular delete labels for a single cell", () => {
    const { editor } = makeEditor();
    const submenu = buildTableSubmenu(
      editor as never,
      analysis({ kind: "tableCell", cell: cell([0], [1]) }),
    );
    const labels = submenu?.items.map((item) => item.label) ?? [];

    expect(labels).toContain("Delete row");
    expect(labels).toContain("Delete column");
    expect(labels).toContain("Clear cell");
  });

  it("pluralises delete labels for a multi-row selection", () => {
    const { editor } = makeEditor();
    const submenu = buildTableSubmenu(
      editor as never,
      analysis({ kind: "tableRow", cell: cell([0, 1], [0]) }),
    );
    const labels = submenu?.items.map((item) => item.label) ?? [];

    expect(labels).toContain("Delete rows");
    expect(labels).toContain("Delete column");
  });

  it("offers only delete table for a whole-table selection", () => {
    const { editor } = makeEditor();
    const submenu = buildTableSubmenu(
      editor as never,
      analysis({ kind: "tableWhole", cell: cell([0], [0]) }),
    );

    expect(submenu?.items.map((item) => item.label)).toEqual(["Delete table"]);
  });

  it("runs the matching command for an item", () => {
    const { editor, chain } = makeEditor();
    const submenu = buildTableSubmenu(
      editor as never,
      analysis({ kind: "tableCell", cell: cell([0], [0]) }),
    );
    const item = submenu?.items.find((entry) => entry.id === "add-row-before");

    item?.handler(undefined);
    expect(chain.addRowBefore).toHaveBeenCalled();
    expect(chain.run).toHaveBeenCalled();
  });
});

describe("buildInsertSubmenu", () => {
  it("lists table, image, latex and code block", () => {
    const { editor } = makeEditor();
    const items = buildInsertSubmenu(editor as never).items;
    expect(items.map((item) => item.label)).toEqual([
      "Table",
      "Image",
      "LaTeX",
      "Code block",
    ]);
  });

  it("inserts a 3x3 table with a header row", () => {
    const { editor, chain } = makeEditor();
    const submenu = buildInsertSubmenu(editor as never);
    submenu.items[0].handler(undefined);

    expect(chain.insertTable).toHaveBeenCalledWith({
      rows: 3,
      cols: 3,
      withHeaderRow: true,
    });
  });

  it("routes the image item through the file dialog bus", () => {
    const openFileDialog = vi.fn();
    useEditorMenuStore.setState({ openFileDialog });
    const { editor } = makeEditor();
    buildInsertSubmenu(editor as never).items[1].handler(undefined);

    expect(openFileDialog).toHaveBeenCalled();
  });

  it("routes the latex item through the latex dialog bus", () => {
    const openLatexDialog = vi.fn();
    useEditorMenuStore.setState({ openLatexDialog });
    const { editor } = makeEditor();
    buildInsertSubmenu(editor as never).items[2].handler(undefined);

    expect(openLatexDialog).toHaveBeenCalled();
  });

  it("sets a code block for the last item", () => {
    const { editor, chain } = makeEditor();
    buildInsertSubmenu(editor as never).items[3].handler(undefined);
    expect(chain.setCodeBlock).toHaveBeenCalled();
  });
});
