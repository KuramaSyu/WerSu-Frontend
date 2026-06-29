// ---------------------------------------------------------------------------
// editorFormatUtils
//
// Pure helpers shared by `NoteEditorCore` and the editor store. Kept
// in their own file (no React, no MUI imports) so they can be
// imported by tests without dragging the rest of the editor's
// dependency graph into the test environment.
// ---------------------------------------------------------------------------

import { Editor, type JSONContent } from "@tiptap/react";
import { normalizeTables } from "../../components/Editor/jsonNormalization";

/**
 * when inserting an image, we need to check if the tiptap editor or
 * source mode is used. The tiptap editor gets an HTML img block,
 * where as the source editor gets the markdown image link.
 *
 * @param imageLink link to build block of
 * @param editorMode editor mode
 * @returns the block for the current editor mode
 */
export function imageLinkToBlock(
  imageLink: string,
  editorMode: "rich" | "source",
): string {
  if (editorMode === "rich") {
    return `<img src="${imageLink}" />`;
  } else {
    return `![image](${imageLink})`;
  }
}

/**
 * Parse a markdown string into a ProseMirror JSON document and
 * normalize table cells so images don't get embedded inside text
 * paragraphs (which would prevent editing the surrounding text).
 */
export function markdownToProsemirror(
  editor: Editor,
  markdown: string,
): JSONContent {
  // first parse markdown normally with builtin markdown extension
  const pmDoc = editor.storage.markdown.manager.parse(markdown);
  // now: a table cell containing an image with text gets rendered to
  // <p>text <img/></p>. The problem with it is, that when now the user
  // starts editing the text, the image just gets deleted and ctrl z is also
  // not possible. Hence we normalize the JSON structure, to render it as <p>text</p><img/>
  // keep in mind, that it parses a JSON, not HTML. I just used HTML for describing
  const normalizedDoc = normalizeTables(pmDoc);
  return normalizedDoc;
}
