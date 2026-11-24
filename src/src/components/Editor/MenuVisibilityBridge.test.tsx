// @vitest-environment jsdom

// Regression: this bridge is a sibling of `EditorContent` and therefore
// mounts *before* the TipTap view exists. Reading `editor.view` then
// throws ("The editor view is not available"), which used to take down
// the whole note page once route/editor code splitting changed the mount
// order.

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { MenuVisibilityBridge } from "./MenuVisibilityBridge";

/** Editor with `element: null`: no view until `mount()` is called. */
function makeUnmountedEditor(): Editor {
  return new Editor({
    extensions: [StarterKit],
    content: "<p>hello</p>",
    element: null,
  });
}

const mounted: Editor[] = [];

afterEach(() => {
  cleanup();
  for (const editor of mounted.splice(0)) {
    editor.destroy();
  }
  useEditorMenuStore.getState().setPointerDown(false);
});

describe("MenuVisibilityBridge", () => {
  it("mounts before the editor view exists without throwing", () => {
    const editor = makeUnmountedEditor();
    mounted.push(editor);

    expect(() =>
      render(<MenuVisibilityBridge editor={editor} provider={null} />),
    ).not.toThrow();
  });

  it("tracks the pointer state once the view is attached", () => {
    const editor = makeUnmountedEditor();
    mounted.push(editor);
    render(<MenuVisibilityBridge editor={editor} provider={null} />);

    const host = document.createElement("div");
    document.body.appendChild(host);
    act(() => {
      editor.mount(host);
    });

    act(() => {
      editor.view.dom.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    });
    expect(useEditorMenuStore.getState().isPointerDown).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
    expect(useEditorMenuStore.getState().isPointerDown).toBe(false);
  });
});
