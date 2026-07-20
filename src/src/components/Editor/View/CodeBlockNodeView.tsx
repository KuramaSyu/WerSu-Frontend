import { createElement, memo, useMemo } from "react";
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { CopyButton } from "../../CopyButton";

// `NodeViewContent` is a generic *function*, not a generic component, so
// `<NodeViewContent<"pre"> />` and `<NodeViewContent as="pre" />` both
// fall back to the default host tag of "div" at runtime. Use `createElement`
// to bypass JSX's type-parameter inference and pass `as="pre"` explicitly so
// the rendered element is actually a `<pre>`.
const PreContent: React.FC = () =>
  createElement(NodeViewContent, { as: "pre" as const });

const COMMON_LANGUAGES = [
  "plaintext",
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "go",
  "graphql",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "markdown",
  "objectivec",
  "perl",
  "php",
  "python",
  "r",
  "ruby",
  "rust",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "vbnet",
  "wasm",
  "xml",
  "yaml",
] as const;

/**
 * Code-block node view: adds a top-right toolbar with a language
 * picker and copy button. Toolbar is `contentEditable={false}` so
 * clicks don't move the caret into the controls.
 */
export const CodeBlockNodeView: React.FC<NodeViewProps> = memo(
  ({ node, updateAttributes, editor }) => {
    const language: string = node.attrs.language ?? "plaintext";
    const code = useMemo(() => node.textContent, [node]);
    const isEditable = editor?.isEditable ?? false;

    const handleLanguageChange = (event: SelectChangeEvent<string>) => {
      const next = event.target.value || null;
      updateAttributes({ language: next });
    };

    return (
      <NodeViewWrapper
        as="div"
        style={{ position: "relative" }}
        data-code-block=""
        data-language={language}
      >
        <PreContent />
        <Box
          contentEditable={false}
          sx={(theme) => ({
            position: "absolute",
            top: theme.spacing(0.5),
            right: theme.spacing(0.5),
            display: "flex",
            alignItems: "center",
            gap: theme.spacing(0.5),
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(0, 0, 0, 0.45)"
                : "rgba(255, 255, 255, 0.85)",
            borderRadius: theme.shape.borderRadius,
            padding: theme.spacing(0.25, 0.5),
            backdropFilter: "blur(4px)",
            opacity: 0.6,
            transition: `opacity ${theme.transitions.duration.standard}ms`,
            "&:hover, &:focus-within": {
              opacity: 1,
            },
          })}
        >
          {isEditable && (
            <FormControl size="small" variant="standard">
              <Select
                value={language}
                onChange={handleLanguageChange}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { maxHeight: 320 } },
                  },
                }}
                inputProps={{ "aria-label": "code block language" }}
                sx={{
                  fontSize: "0.75rem",
                  "& .MuiSelect-select": {
                    padding: "2px 24px 2px 6px",
                  },
                  "& .MuiSvgIcon-root": {
                    fontSize: "1rem",
                  },
                }}
              >
                <MenuItem value="plaintext">Plain text</MenuItem>
                <Box component="li" sx={{ listStyle: "none", my: 0.25 }}>
                  <Box
                    sx={(theme) => ({
                      borderTop: `1px solid ${theme.palette.divider}`,
                    })}
                  />
                </Box>
                {COMMON_LANGUAGES.filter((l) => l !== "plaintext").map(
                  (lang) => (
                    <MenuItem key={lang} value={lang}>
                      {lang}
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>
          )}
          <Box sx={{ display: "inline-flex" }}>
            <CopyButton size="small" aria-label="copy code block" text={code} />
          </Box>
        </Box>
      </NodeViewWrapper>
    );
  },
);

CodeBlockNodeView.displayName = "CodeBlockNodeView";
