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
 *   CustomCodeBlock.configure({ lowlight }),
 *   // ...
 * ]
 * ```
 */
export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
});

export default CustomCodeBlock;
