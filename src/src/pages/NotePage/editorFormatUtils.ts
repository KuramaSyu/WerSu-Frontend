// Pure helpers shared by NoteEditorCore. Kept MUI-free so tests can
// import this without dragging the rest of the editor's dep graph.

// Builds the insertion block for an image based on the current
// editor mode: rich gets an HTML img, source gets a markdown link.
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
