// Resolve what the pointer hit inside the editor.
//
// Browsers do not move the ProseMirror selection on right-click, so
// the contextmenu handler has to look the element up itself. It tries
// the pointer coordinates first, then falls back to the DOM event
// target (the reliable path for node views like images).

import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type EditorContextTargetKind = "table" | "image" | "codeBlock";

export interface EditorContextTarget {
  kind: EditorContextTargetKind;
  /** Document range of the whole target node. */
  from: number;
  to: number;
  /** Position the pointer landed on. */
  hitPos: number;
  node: ProseMirrorNode;
}

const KIND_BY_NODE: Record<string, EditorContextTargetKind> = {
  table: "table",
  image: "image",
  codeBlock: "codeBlock",
};

function asTarget(
  node: ProseMirrorNode,
  from: number,
  hitPos: number,
): EditorContextTarget | null {
  const kind = KIND_BY_NODE[node.type.name];
  if (!kind) return null;
  return { kind, from, to: from + node.nodeSize, hitPos, node };
}

// Walk the resolved position to the innermost matching element.
function findTargetFromPos(
  editor: Editor,
  pos: number,
): EditorContextTarget | null {
  const doc = editor.state.doc;
  const $pos = doc.resolve(pos);

  // Innermost ancestor first: an image inside a table cell resolves as
  // image, a cell resolves as the enclosing table.
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    const target = asTarget(node, $pos.before(depth), pos);
    if (target) return target;
  }

  // Leaves resolve at a block boundary, so also check the node whose
  // edge the pointer is on.
  if ($pos.nodeAfter) {
    const target = asTarget($pos.nodeAfter, $pos.pos, pos);
    if (target) return target;
  }
  if ($pos.nodeBefore) {
    const edge = $pos.pos - $pos.nodeBefore.nodeSize;
    const target = asTarget($pos.nodeBefore, edge, pos);
    if (target) return target;
  }

  return null;
}

// Map a DOM element inside the editor back to its ProseMirror node.
function findTargetFromDom(
  editor: Editor,
  element: Element,
): EditorContextTarget | null {
  const view = editor.view;
  if (!view.dom.contains(element)) return null;

  const domNode =
    element.closest("img") ??
    element.closest("[data-code-block]") ??
    element.closest(".table-nodeview") ??
    element.closest("table");
  if (!domNode) return null;

  try {
    const pos = view.posAtDOM(domNode, 0);
    return findTargetFromPos(editor, pos);
  } catch {
    return null;
  }
}

export function resolveEditorContextTarget(
  editor: Editor,
  coords: { x: number; y: number },
  eventTarget?: EventTarget | null,
): EditorContextTarget | null {
  const hit = editor.view.posAtCoords({ left: coords.x, top: coords.y });
  const fromCoords = hit ? findTargetFromPos(editor, hit.pos) : null;
  if (fromCoords) return fromCoords;

  if (eventTarget instanceof Element) {
    return findTargetFromDom(editor, eventTarget);
  }
  return null;
}

// Put the editor selection on the target when the table analysis needs
// it. Images and code blocks are deliberately left unselected: their
// commands act on the target range directly, so the editor should not
// paint a selection background around the node.
export function applyEditorContextTarget(
  editor: Editor,
  target: EditorContextTarget,
): void {
  if (target.kind === "table") {
    editor.commands.setTextSelection(target.hitPos);
  }
}
