import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import { posToDOMRect } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import type { VirtualElement } from "@floating-ui/react";

/**
 * The bubble menus are driven entirely by React state, so they need a
 * floating-ui reference for the current selection. A `VirtualElement`
 * lets `computePosition`/`autoUpdate` anchor to a plain rect instead of
 * a DOM node.
 */
function toVirtualElement(rect: DOMRect | null): VirtualElement | null {
  if (!rect) return null;
  return {
    getBoundingClientRect: () => rect,
    getClientRects: () => [rect],
  };
}

function unionRects(a: DOMRect, b: DOMRect): DOMRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return new DOMRect(left, top, right - left, bottom - top);
}

function elementForPos(view: EditorView, pos: number): HTMLElement | null {
  const node = view.nodeDOM(pos) as HTMLElement | null;
  if (!node) return null;
  const wrapper = node.dataset?.nodeViewWrapper
    ? node
    : (node.querySelector?.("[data-node-view-wrapper]") as HTMLElement | null);
  return wrapper ?? node;
}

/** Bounding rect of the current text / table selection, in viewport space. */
function textSelectionRect(editor: Editor): DOMRect | null {
  const { selection } = editor.state;
  const view = editor.view;

  // Cell selections span their first cell only, so union the anchor /
  // head cell rects to cover the whole selected band.
  if (selection instanceof CellSelection) {
    const fromEl = elementForPos(view, selection.$anchorCell.pos);
    const toEl = elementForPos(view, selection.$headCell.pos);
    if (!fromEl || !toEl) return null;
    if (fromEl === toEl) return fromEl.getBoundingClientRect();
    return unionRects(
      fromEl.getBoundingClientRect(),
      toEl.getBoundingClientRect(),
    );
  }

  // Collapsed selections still return a caret rect; consumers decide
  // whether a caret deserves a menu (the text menu does not, the pinned
  // table menu does).
  return posToDOMRect(view, selection.from, selection.to);
}

/** Bounding rect of a selected node (image, embed), in viewport space. */
function nodeSelectionRect(editor: Editor): DOMRect | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;
  return elementForPos(editor.view, selection.from)?.getBoundingClientRect() ?? null;
}

/**
 * Recomputes `compute` while `active`, and on every selection /
 * document transaction, viewport scroll and resize. Returns a virtual
 * element (or null) for floating-ui.
 */
function useEditorRect(
  editor: Editor,
  active: boolean,
  compute: (editor: Editor) => DOMRect | null,
): VirtualElement | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active) {
      // Drop the stale rect while hidden. Otherwise the next open exposes
      // the previous selection's rect for one render, so
      // `BubbleMenuSurface` snaps there and then slides to the new
      // selection instead of appearing at it directly.
      setRect(null);
      return;
    }

    const update = () => {
      if (editor.isDestroyed) return;
      try {
        setRect(compute(editor));
      } catch {
        setRect(null);
      }
    };

    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // `compute` is one of the stable module-level rect readers.
  }, [editor, active, compute]);

  // While inactive the last rect is stale; only expose it while active.
  return useMemo(
    () => toVirtualElement(active ? rect : null),
    [active, rect],
  );
}

/** Anchor for the text-formatting / table-ops bubble menu. */
export function useTextSelectionAnchor(
  editor: Editor,
  active: boolean,
): VirtualElement | null {
  return useEditorRect(editor, active, textSelectionRect);
}

/** Anchor for the image bubble menu (anchored to the selected node). */
export function useNodeSelectionAnchor(
  editor: Editor,
  active: boolean,
): VirtualElement | null {
  return useEditorRect(editor, active, nodeSelectionRect);
}
