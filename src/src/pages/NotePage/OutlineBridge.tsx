// ---------------------------------------------------------------------------
// OutlineBridge
// Mirrors the editor's heading outline into useOutlineStore on every
// editor.on("update"). Each heading gets a stable kebab slug used as
// the URL section param and stamped on the DOM node for deep-link
// and click-to-scroll. Renders nothing.
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

    editor.on("update", push);
    push();
    return () => {
      editor.off("update", push);
      useOutlineStore.getState().clear();
    };
  }, [editor]);

  return null;
};

/** Memoized so a parent re-render does not re-fire the update subscription. */
export const OutlineBridge = memo(OutlineBridgeImpl);
