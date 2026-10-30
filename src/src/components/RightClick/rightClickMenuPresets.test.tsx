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
  buildCodeBlockCommands,
  buildEditorMenuRequest,
  buildImageCommands,
  buildInsertSubmenu,
  buildTableMenuRows,
} from "./rightClickMenuPresets";
import type { EditorContextTarget } from "../Editor/editorContextTarget";
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
    "deleteRange",
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

  it("adds table rows when the click lands in a table", () => {
    mocks.analyseSelection.mockReturnValue(
      analysis({ kind: "tableCell", cell: cell([1], [2]) }),
    );
    const { editor } = makeEditor();
    const request = buildEditorMenuRequest(editor as never, true, position);

    expect(request.buttons).toEqual(["copy", "paste", "cut", "insert"]);
    expect(request.leadingComponents?.map((row) => row.key)).toEqual([
      "delete-table",
      "table-rows",
      "table-columns",
      "clear-cells",
    ]);
  });
});

describe("buildTableMenuRows", () => {
  it("returns no rows outside a table", () => {
    const { editor } = makeEditor();
    expect(buildTableMenuRows(editor as never, analysis())).toEqual([]);
  });

  it("uses delete table, rows, columns, clear cell for a single cell", () => {
    const { editor } = makeEditor();
    const a = analysis({ kind: "tableCell", cell: cell([0], [1]) });
    const rows = buildTableMenuRows(editor as never, a);

    expect(rows.map((row) => row.label)).toEqual([
      "Delete table",
      "Rows",
      "Columns",
      "Clear cell",
    ]);
    const rowLabels = rows[1].submenu?.items.map((item) => item.label) ?? [];
    const colLabels = rows[2].submenu?.items.map((item) => item.label) ?? [];
    expect(rowLabels).toContain("Delete row");
    expect(colLabels).toContain("Delete column");
  });

  it("pluralises delete labels for a multi-row selection", () => {
    const { editor } = makeEditor();
    const a = analysis({ kind: "tableRow", cell: cell([0, 1], [0]) });
    const rows = buildTableMenuRows(editor as never, a);

    const rowLabels = rows[1].submenu?.items.map((item) => item.label) ?? [];
    const colLabels = rows[2].submenu?.items.map((item) => item.label) ?? [];
    expect(rowLabels).toContain("Delete rows");
    expect(colLabels).toContain("Delete column");
  });

  it("offers only delete table for a whole-table selection", () => {
    const { editor } = makeEditor();
    const rows = buildTableMenuRows(
      editor as never,
      analysis({ kind: "tableWhole", cell: cell([0], [0]) }),
    );

    expect(rows.map((row) => row.label)).toEqual(["Delete table"]);
  });

  it("runs the matching command from a submenu", () => {
    const { editor, chain } = makeEditor();
    const rows = buildTableMenuRows(
      editor as never,
      analysis({ kind: "tableCell", cell: cell([0], [0]) }),
    );
    const item = rows[1].submenu?.items.find(
      (entry) => entry.id === "add-row-before",
    );

    item?.handler(undefined);
    expect(chain.addRowBefore).toHaveBeenCalled();
    expect(chain.run).toHaveBeenCalled();
  });
});

describe("element commands", () => {
  it("offers copy link then delete for an image with a src", () => {
    const { editor } = makeEditor();
    const node = { attrs: { src: "http://img/x.png" } } as never;
    const target = {
      kind: "image",
      from: 1,
      to: 2,
    } as EditorContextTarget;
    const rows = buildImageCommands(editor as never, node, target);
    expect(rows.map((row) => row.label)).toEqual([
      "Copy image link",
      "Delete image",
    ]);
    expect(rows[0].handler).toBeTypeOf("function");
  });

  it("omits copy link when the image has no src", () => {
    const { editor } = makeEditor();
    const node = { attrs: {} } as never;
    const target = {
      kind: "image",
      from: 1,
      to: 2,
    } as EditorContextTarget;
    const rows = buildImageCommands(editor as never, node, target);
    expect(rows.map((row) => row.label)).toEqual(["Delete image"]);
  });

  it("deletes a code block through deleteRange", () => {
    const { editor, chain } = makeEditor();
    const node = { textContent: "const a = 1;" } as never;
    const target = {
      kind: "codeBlock",
      from: 5,
      to: 21,
    } as EditorContextTarget;
    const rows = buildCodeBlockCommands(editor as never, node, target);
    expect(rows.map((row) => row.label)).toEqual([
      "Copy code",
      "Delete code block",
    ]);
    rows[1].handler?.(undefined);
    expect(chain.deleteRange).toHaveBeenCalledWith({ from: 5, to: 21 });
  });

  it("appends element rows when the request targets an image", () => {
    const { editor } = makeEditor();
    const node = { attrs: { src: "http://img/x.png" } } as never;
    const target = {
      kind: "image",
      from: 1,
      to: 2,
      hitPos: 1,
      node,
    } as EditorContextTarget;
    const request = buildEditorMenuRequest(
      editor as never,
      true,
      position,
      target,
    );
    expect(request.leadingComponents?.map((row) => row.key)).toEqual([
      "image-copy-link",
      "image-delete",
    ]);
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
