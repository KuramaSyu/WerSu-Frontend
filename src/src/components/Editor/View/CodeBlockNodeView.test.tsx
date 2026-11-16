// @vitest-environment jsdom

// The code-block node view renders a line-number gutter only in view mode
// (when the editor is not editable). The gutter must appear next to the
// code and disappear as soon as the editor becomes editable again.
//
// A "mermaid" code block additionally renders a diagram preview above the
// source. The real `MermaidPreview` is stubbed out: it lazily imports the
// `mermaid` package, which cannot run in jsdom (no layout engine), and the
// node view's wiring is what these tests care about, not the renderer.

import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { lowlight } from "../lowlight";

// The real helper rewrites the DOM selection; the wiring test only needs to
// prove *when* it is invoked.
const caretSync = vi.hoisted(() => ({ syncCaretAfterPreviewResize: vi.fn() }));
vi.mock("../mermaid/mermaidPreviewResize", () => caretSync);

vi.mock("./MermaidPreview", () => ({
  MermaidPreview: ({ code }: { code: string }) => (
    <div data-mermaid-preview-stub="">{code}</div>
  ),
}));

const createEditor = (content: string) =>
  new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
    ],
    content,
  });

// React node views mount through a portal, so a microtask flush is needed
// before the rendered DOM reflects the component.
const flush = () => act(async () => undefined);

describe("CodeBlockNodeView line numbers", () => {
  it("renders one number per code line while in view mode", async () => {
    const editor = createEditor("<pre><code>first\nsecond\nthird</code></pre>");
    render(<EditorContent editor={editor} />);
    try {
      await flush();
      await act(async () => editor.setEditable(false));
      await flush();

      const gutter = editor.view.dom.querySelector("[data-line-numbers]");
      expect(gutter).not.toBeNull();
      expect(
        Array.from(gutter?.querySelectorAll("div") ?? []).map(
          (el) => el.textContent,
        ),
      ).toEqual(["1", "2", "3"]);
    } finally {
      editor.destroy();
    }
  });

  it("hides the gutter while the editor is editable", async () => {
    const editor = createEditor("<pre><code>first\nsecond</code></pre>");
    render(<EditorContent editor={editor} />);
    try {
      await flush();
      await act(async () => editor.setEditable(true));
      await flush();

      expect(editor.view.dom.querySelector("[data-line-numbers]")).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});

// Fake ResizeObserver: jsdom has none, and the node view uses it to detect
// the asynchronous preview height changes that move the caret.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  observed: Element[] = [];
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  unobserve(): void {}

  disconnect(): void {}

  fire(height: number): void {
    this.callback(
      [{ contentRect: { height } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

/** Finds the observer the node view attached to the preview container. */
const previewObserver = (): FakeResizeObserver | undefined =>
  FakeResizeObserver.instances.find((instance) =>
    instance.observed.some((element) =>
      (element as HTMLElement).hasAttribute("data-mermaid-preview-container"),
    ),
  );

describe("CodeBlockNodeView mermaid caret sync", () => {
  it("re-applies the DOM selection when the preview changes size", async () => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal(
      "ResizeObserver",
      FakeResizeObserver as unknown as typeof ResizeObserver,
    );
    caretSync.syncCaretAfterPreviewResize.mockClear();

    const editor = createEditor(mermaidBlockHtml);
    render(<EditorContent editor={editor} />);
    try {
      await flush();

      const observer = previewObserver();
      expect(observer).toBeDefined();

      // The first real height (diagram committed) must move the caret.
      act(() => observer!.fire(40));
      expect(caretSync.syncCaretAfterPreviewResize).toHaveBeenCalledTimes(1);
      expect(caretSync.syncCaretAfterPreviewResize).toHaveBeenCalledWith(editor);

      // Sub-pixel noise must not rewrite the selection.
      act(() => observer!.fire(40.4));
      expect(caretSync.syncCaretAfterPreviewResize).toHaveBeenCalledTimes(1);

      // A later size change must move it again.
      act(() => observer!.fire(96));
      expect(caretSync.syncCaretAfterPreviewResize).toHaveBeenCalledTimes(2);
    } finally {
      editor.destroy();
      vi.unstubAllGlobals();
    }
  });

  it("does not observe a preview for plain code blocks", async () => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal(
      "ResizeObserver",
      FakeResizeObserver as unknown as typeof ResizeObserver,
    );
    caretSync.syncCaretAfterPreviewResize.mockClear();

    const editor = createEditor("<pre><code>const a = 1;</code></pre>");
    render(<EditorContent editor={editor} />);
    try {
      await flush();

      expect(previewObserver()).toBeUndefined();
      expect(caretSync.syncCaretAfterPreviewResize).not.toHaveBeenCalled();
    } finally {
      editor.destroy();
      vi.unstubAllGlobals();
    }
  });
});

const MERMAID_SOURCE = "flowchart TD\n    A --> B";
const mermaidBlockHtml = `<pre><code class="language-mermaid">${MERMAID_SOURCE}</code></pre>`;

describe("CodeBlockNodeView mermaid preview", () => {
  it("renders the diagram preview for a mermaid code block", async () => {
    const editor = createEditor(mermaidBlockHtml);
    render(<EditorContent editor={editor} />);
    try {
      await flush();

      const preview = editor.view.dom.querySelector(
        "[data-mermaid-preview-stub]",
      );
      expect(preview).not.toBeNull();
      expect(preview?.textContent).toContain("flowchart TD");
      expect(preview?.textContent).toContain("A --> B");
      expect(
        editor.view.dom.querySelector("[data-mermaid-preview-container]"),
      ).not.toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("renders the preview after the source row so the caret never moves", async () => {
    const editor = createEditor(mermaidBlockHtml);
    render(<EditorContent editor={editor} />);
    try {
      await flush();

      const preview = editor.view.dom.querySelector(
        "[data-mermaid-preview-container]",
      );
      const content = editor.view.dom.querySelector(
        "[data-node-view-content-react]",
      );
      expect(preview).not.toBeNull();
      expect(content).not.toBeNull();
      // The asynchronous preview must come *after* the code: a height change
      // above an active selection makes browsers leave the caret painted at
      // its old screen position.
      expect(
        content!.compareDocumentPosition(preview!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    } finally {
      editor.destroy();
    }
  });

  it("renders no preview for a plaintext code block", async () => {
    const editor = createEditor("<pre><code>const a = 1;</code></pre>");
    render(<EditorContent editor={editor} />);
    try {
      await flush();

      expect(
        editor.view.dom.querySelector("[data-mermaid-preview-stub]"),
      ).toBeNull();
      expect(
        editor.view.dom.querySelector("[data-mermaid-preview-container]"),
      ).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("keeps the preview and the contentDOM mounted in read-only mode", async () => {
    const editor = createEditor(mermaidBlockHtml);
    render(<EditorContent editor={editor} />);
    try {
      await flush();
      await act(async () => editor.setEditable(false));
      await flush();

      // The diagram stays visible...
      expect(
        editor.view.dom.querySelector("[data-mermaid-preview-stub]"),
      ).not.toBeNull();

      // ...and the source row is only hidden, never unmounted: Tiptap's
      // contentDOM must stay in the document for view/collaboration state.
      // The "display: none" is set through MUI `sx` (an injected class), so
      // it is not asserted here - jsdom's cascade is not a reliable oracle.
      const content = editor.view.dom.querySelector(
        "[data-node-view-content-react]",
      );
      expect(content).not.toBeNull();
      expect(content?.isConnected).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
