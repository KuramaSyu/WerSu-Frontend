import { styled } from "@mui/material/styles";
import { Box } from "@mui/material";

// primarily to highlight `code` markdown elements - theming of the
// actual ``` ``` codeblock is done elsewhere (CodeBlockNodeView, ThemedEditorBox)
export const CodeBlockThemer = styled(Box)(({ theme }) => ({
  // Wrapper styles
  "&.tiptap": {
    "& :first-of-type": {
      marginTop: 0,
    },

    pre: {
      // Static code-block fallback (no React node view).
      // Node-view code blocks have `[data-node-view-content]` and
      // style their own wrapper, so this rule is intentionally
      // scoped to non-node-view `<pre>` to avoid the
      // double-padding/border of both layers adding up.
      "&:not([data-node-view-content])": {
        background: theme.palette.background.paper,
        borderRadius: "0.5rem",
        color: theme.palette.text.primary,
        fontFamily: `'JetBrainsMono', monospace`,
        margin: "1.5rem 0",
        padding: "0.75rem 1rem",
        overflowX: "auto",
      },

      code: {
        background: "none",
        color: "inherit",
        fontSize: "0.8rem",
        padding: 0,
      },

      // Per-token colors come from the hljs CSS themes imported in
      // `./lowlight` (atom-one-light.css / atom-one-dark.css).
      // This wrapper only paints the code-block chrome.
    },
  },
}));
