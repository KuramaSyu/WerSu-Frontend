// @vitest-environment jsdom

// The Mermaid button in the right-rail formatting panel must insert a
// regular `codeBlock` node tagged `language: "mermaid"` (that node view is
// what renders the live diagram). The panel reads the live editor from the
// zustand store, so the test drives the real component instead of calling
// `insertMermaidBlock` directly.

import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CustomCodeBlock } from "./View/CustomCodeBlock";
import { lowlight } from "./lowlight";
import { FormattingPanel } from "./FormattingPanel";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import "../../test/setup";

const createEditor = (): Editor =>
  new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
    ],
    content: "<p>hello</p>",
  });

/** Every code block in the document, in document order. */
const codeBlocks = (editor: Editor) => {
  const found: { language: string | null; text: string }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "codeBlock") {
      found.push({ language: node.attrs.language, text: node.textContent });
    }
    return true;
  });
  return found;
};

describe("FormattingPanel Mermaid button", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    // Clear the store before the global setup snapshots it: an Editor
    // holds a circular ProseMirror view and must not be serialised.
    useActiveNoteStore.setState({ editor: null });
    editor?.destroy();
    editor = null;
  });

  it("inserts a mermaid code block when clicked", () => {
    editor = createEditor();
    useActiveNoteStore.setState({ editor });
    useEditorSettings.setState({ editMode: true, viewMode: "rich" });

    render(<FormattingPanel />);

    const button = screen.getByLabelText("insert mermaid");
    expect(button).toBeInTheDocument();

    act(() => {
      fireEvent.click(button);
    });

    const blocks = codeBlocks(editor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("mermaid");
    expect(blocks[0].text).toContain("flowchart TD");
  });
});