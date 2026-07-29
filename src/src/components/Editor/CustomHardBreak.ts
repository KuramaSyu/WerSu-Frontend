// Override of the stock HardBreak that emits literal HTML so the break
// survives table-cell whitespace collapsing and inline HTML merging.

import { HardBreak } from "@tiptap/extension-hard-break";

export const CustomHardBreak = HardBreak.extend({
  renderMarkdown: () => "<br/>",
});
