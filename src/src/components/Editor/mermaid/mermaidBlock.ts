// Mermaid is *not* a node type of its own: it is a regular `codeBlock`
// node with `language: "mermaid"`, so it round-trips through markdown as a
// plain fenced code block:
//
//   ```mermaid
//   flowchart TD
//       A --> B
//   ```
//
// Everything that needs to recognise or create such a block shares this
// module so the slash command, the formatting rail and the code-block node
// view can never disagree on the language tag or the starter template.

import type { Editor } from "@tiptap/core";

/** Language tag stored on the `codeBlock` node and in the markdown fence. */
export const MERMAID_LANGUAGE = "mermaid";

/**
 * Starter diagram inserted by `/mermaid` and the formatting-rail button.
 * Small enough to stay readable while the user rewrites it, but already
 * valid Mermaid so the live preview renders immediately.
 */
export const MERMAID_TEMPLATE = [
  "flowchart TD",
  "    A[Start] --> B{Decision}",
  "    B -->|Yes| C[Do the thing]",
  "    B -->|No| D[Try again]",
].join("\n");

/** True when a `codeBlock` node holds a Mermaid diagram rather than code. */
export const isMermaidLanguage = (
  language: string | null | undefined,
): boolean =>
  typeof language === "string" &&
  language.trim().toLowerCase() === MERMAID_LANGUAGE;

/**
 * Inserts an empty Mermaid code block (pre-filled with
 * {@link MERMAID_TEMPLATE}) at the current selection.
 *
 * Callers that replace a slash query first clear that line, so this only
 * has to place the block.
 */
export const insertMermaidBlock = (editor: Editor): void => {
  const block = {
    type: "codeBlock",
    attrs: { language: MERMAID_LANGUAGE },
    content: [{ type: "text", text: MERMAID_TEMPLATE }],
  };

  // Inserting a code block while the caret already sits inside one would
  // nest a code block in a code block (impossible) or dump the template as
  // text. Place the diagram as a sibling right after the current block
  // instead.
  if (editor.isActive("codeBlock")) {
    const { $from } = editor.state.selection;
    let depth = $from.depth;
    while (depth > 0 && $from.node(depth).type.name !== "codeBlock") {
      depth -= 1;
    }
    if (depth > 0) {
      editor
        .chain()
        .focus()
        .insertContentAt($from.after(depth), block)
        .run();
      return;
    }
  }

  editor.chain().focus().insertContent(block).run();
};