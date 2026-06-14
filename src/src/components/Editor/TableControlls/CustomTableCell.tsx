import TableCell from "@tiptap/extension-table-cell";

export const CustomTableCell = TableCell.extend({
  content: "(paragraph | image | codeBlock | blockquote)+",
});
