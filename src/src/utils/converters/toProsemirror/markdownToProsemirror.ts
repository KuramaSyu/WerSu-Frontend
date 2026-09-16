import { Editor, type JSONContent } from "@tiptap/react";
import {
  normalizeListInCells,
  normalizeTables,
} from "../../../components/Editor/jsonNormalization";

// Parse a markdown string into a ProseMirror JSON document and normalize
// table cells so images don't get embedded inside text paragraphs (which
// would prevent editing the surrounding text). Also normalizes list-shaped
// cell content (a cell that came back as - a<br/>- b<br/>- c or that was
// pasted as - a\n- b\n- c) into a real bulletList / orderedList node.
export function markdownToProsemirror(
  editor: Editor,
  markdown: string,
): JSONContent {
  const pmDoc = editor.storage.markdown.manager.parse(markdown);
  const tableNormalized = normalizeTables(pmDoc);
  const normalizedDoc = normalizeListInCells(tableNormalized);
  return normalizedDoc;
}