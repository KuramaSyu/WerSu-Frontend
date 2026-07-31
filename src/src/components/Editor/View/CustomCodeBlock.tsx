import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockNodeView } from "./CodeBlockNodeView";

/**
 * `CodeBlockLowlight` re-exported with a React node view that adds
 * a language picker and copy button in the top-right corner.
 *
 * The original `CodeBlockLowlight` is a `Node.extend(...)`, so all
 * options, plugins, and addCommands from the upstream extension
 * are preserved — we only swap the renderer.
 *
 * Usage is identical to the stock extension:
 *
 * ```ts
 * import { CustomCodeBlock } from ".../Editor/View/CustomCodeBlock";
 *
 * extensions: [
 *   CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
 *   // ...
 * ]
 * ```
 *
 * Always pair the `lowlight` instance with `defaultLanguage: "plaintext"`.
 * Without it, `@tiptap/extension-code-block-lowlight` falls back to
 * `lowlight.highlightAuto(...)` for any code block without an explicit
 * `language` attr, which freezes the editor on real notes. See
 * [components/Editor/lowlight.ts](../../Editor/lowlight.ts) for the
 * full rationale.
 */
export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },

  // Canonicalize the language attr on the read side: a bare ``` fence
  // (no tag after the backticks) becomes `language: "plaintext"`.
  // Otherwise the extension would fail to render its contents resulting
  // in missing contents
  parseMarkdown: (token, helpers) => {
    if (
      token.raw?.startsWith("```") === false &&
      token.raw?.startsWith("~~~") === false &&
      token.codeBlockStyle !== "indented"
    ) {
      return [];
    }

    return helpers.createNode(
      "codeBlock",
      { language: token.lang || "plaintext" },
      token.text ? [helpers.createTextNode(token.text)] : [],
    );
  },

  // Drop the `plaintext` language tag from the markdown writeback so
  // plain code blocks round-trip as bare ``` fences. Any other language
  // is preserved verbatim inside the fence.
  renderMarkdown: (node, h) => {
    const raw = node.attrs?.language;
    const language = raw && raw !== "plaintext" ? raw : "";
    if (!node.content) {
      return `\`\`\`${language}\n\n\`\`\``;
    }
    return `\`\`\`${language}\n${h.renderChildren(node.content)}\n\`\`\``;
  },
});

export default CustomCodeBlock;
