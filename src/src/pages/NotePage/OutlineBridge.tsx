// ---------------------------------------------------------------------------
// OutlineBridge
// Mirrors the editor's heading outline into useOutlineStore. It only
// pushes on structural heading changes (level, text content, count, or
// presence), skipped via a cached `level:textContent` signature; this
// keeps the bridge silent while the user types into body paragraphs.
// Each heading gets a stable kebab slug stamped on its DOM node for the
// URL `?section=<id>` param, deep-link, and click-to-scroll. Renders nothing.
// ---------------------------------------------------------------------------

import { memo, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { useOutlineStore } from "../../zustand/outlineStore";
import { uniqueSlugify } from "../../utils/slugify";
import { logRerender } from "./editorRenderLog";

export interface OutlineBridgeProps {
  editor: Editor | null;
}

const OutlineBridgeImpl: React.FC<OutlineBridgeProps> = ({ editor }) => {
  logRerender("OutlineBridge", { hasEditor: !!editor });
  useEffect(() => {
    if (!editor) return;

    // Cheap structural signature: walks the doc once and serializes the
    // heading sequence as `level:textContent` tokens. Stable across body
    // edits so the per-keystroke outline rebuild is skipped while typing.
    const signature = (doc: typeof editor.state.doc): string => {
      const parts: string[] = [];
      doc.descendants((node) => {
        if (node.type.name !== "heading") return;
        if (node.textContent.length === 0) return;
        parts.push(`${node.attrs.level ?? 1}:${node.textContent}`);
      });
      return parts.join("|");
    };

    let prevSig = signature(editor.state.doc);

    const push = () => {
      const doc = editor.state.doc;
      const headings: {
        level: number;
        textContent: string;
        dom: HTMLElement;
      }[] = [];
      doc.descendants((node, pos) => {
        if (node.type.name !== "heading") return;
        const textContent = node.textContent;
        if (textContent.length === 0) return;
        const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
        if (!dom) return;
        headings.push({
          level: node.attrs.level ?? 1,
          textContent,
          dom,
        });
      });

      prevSig = signature(doc);

      if (headings.length === 0) {
        useOutlineStore.getState().clear();
        return;
      }

      const slugs = uniqueSlugify(headings.map((h) => h.textContent));
      for (let i = 0; i < headings.length; i++) {
        const dom = headings[i].dom;
        if (dom.id !== slugs[i]) {
          dom.id = slugs[i];
        }
      }
      const items = headings.map((heading, index) => ({
        id: slugs[index],
        level: heading.level,
        textContent: heading.textContent,
      }));
      useOutlineStore.getState().setItems(items);
    };

    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      // No-doc changes (selection moves, mark refreshes with no range
      // change) can't affect the heading list -> skip the rebuild.
      if (!transaction.docChanged) return;
      // Heading list unchanged -> skip. This is the per-keystroke skip
      // for body typing that used to re-walk + re-slug + re-render.
      if (signature(editor.state.doc) === prevSig) return;
      push();
    };

    editor.on("transaction", onTransaction);
    push();
    return () => {
      editor.off("transaction", onTransaction);
      useOutlineStore.getState().clear();
    };
  }, [editor]);

  return null;
};

/** Memoized so a parent re-render does not re-fire the transaction subscription. */
export const OutlineBridge = memo(OutlineBridgeImpl);
