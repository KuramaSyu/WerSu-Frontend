// @vitest-environment jsdom

import { act, render, waitFor } from "@testing-library/react";
import { EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { afterEach, describe, expect, it } from "vitest";
import { TableWithControls } from "./TableControlls";

const editors: Editor[] = [];

function createEditor(): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit,
      TableRow,
      TableCell,
      TableHeader,
      TableWithControls,
    ],
    content:
      "<table><tbody>" +
      "<tr><th><p>Name</p></th><th><p>Score</p></th></tr>" +
      "<tr><td><p>Zoe</p></td><td><p>2</p></td></tr>" +
      "<tr><td><p>Amy</p></td><td><p>10</p></td></tr>" +
      "<tr><td><p>Bob</p></td><td><p>1</p></td></tr>" +
      "</tbody></table>",
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

describe("table sort controls", () => {
  it("only offers sorting while the editor is in view mode", async () => {
    const editor = createEditor();
    const { container } = render(<EditorContent editor={editor} />);
    expect(container.querySelectorAll("[data-table-sort-button]")).toHaveLength(
      0,
    );

    await act(async () => editor.setEditable(false));
    await waitFor(() => {
      expect(container.querySelectorAll("[data-table-sort-button]")).toHaveLength(
        2,
      );
    });

    await act(async () => editor.setEditable(true));
    await waitFor(() => {
      expect(container.querySelectorAll("[data-table-sort-button]")).toHaveLength(
        0,
      );
    });
  });

  it("re-orders the DOM without changing the document", async () => {
    const editor = createEditor();
    const before = editor.getHTML();
    const { container } = render(<EditorContent editor={editor} />);
    await act(async () => editor.setEditable(false));

    const button = await waitFor(() => {
      const found = container.querySelector<HTMLButtonElement>(
        '[data-table-sort-button][data-column-index="0"]',
      );
      expect(found).not.toBeNull();
      return found!;
    });

    const rows = () =>
      Array.from(
        container.querySelectorAll("[data-node-view-content-react] > tr"),
      ).map((row) => row.textContent);

    await act(async () => button.click());
    expect(rows()).toEqual(["NameScore", "Amy10", "Bob1", "Zoe2"]);

    await act(async () => button.click());
    expect(rows()).toEqual(["NameScore", "Zoe2", "Bob1", "Amy10"]);

    // Third click cycles back to the document's original order.
    await act(async () => button.click());
    expect(rows()).toEqual(["NameScore", "Zoe2", "Amy10", "Bob1"]);
    expect(button.dataset.sortDirection).toBeUndefined();

    expect(editor.getHTML()).toBe(before);
  });
});
