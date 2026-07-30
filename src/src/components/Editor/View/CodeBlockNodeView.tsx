import { createElement, memo, useMemo } from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { CopyButton } from "../../CopyButton";
import { SUPPORTED_LANGUAGES } from "../lowlight";

// `NodeViewContent` is a generic *function*, not a generic component, so
// `<NodeViewContent<"pre" />` and `<NodeViewContent as="pre" />` both
// fall back to the default host tag of "div" at runtime. Use `createElement`
// to bypass JSX's type-parameter inference and pass `as="pre"` explicitly so
// the rendered element is actually a `<pre>`.
const PreContent: React.FC = () =>
  createElement(NodeViewContent, { as: "pre" as const });

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

    const handleLanguageChange = (_event: unknown, value: string | null) => {
      updateAttributes({ language: value || null });
    };

    return (
      <NodeViewWrapper
        as="div"
        style={{ position: "relative" }}
        data-code-block=""
        data-language={language}
      >
        <Box
          sx={{
            backgroundColor: (theme) => theme.palette.background.default,
            p: 1,
            borderRadius: 2,
          }}
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
              backgroundColor: theme.palette.background.default,
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
              <Autocomplete
                size="small"
                value={language}
                disableClearable
                blurOnSelect
                selectOnFocus
                handleHomeEndKeys
                options={SUPPORTED_LANGUAGES as string[]}
                onChange={handleLanguageChange}
                slotProps={{
                  popper: { placement: "bottom-end" },
                  paper: { sx: { maxHeight: 320 } },
                  listbox: {
                    sx: { fontSize: "0.75rem", py: 0 },
                  },
                }}
                sx={{
                  width: 160,
                  "& .MuiInputBase-input": {
                    fontSize: "0.75rem",
                    padding: "2px 6px",
                  },
                  "& .MuiSvgIcon-root": {
                    fontSize: "1rem",
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="standard"
                    aria-label="code block language"
                    placeholder="Language"
                  />
                )}
              />
            )}
            <Box sx={{ display: "inline-flex" }}>
              <CopyButton
                size="small"
                aria-label="copy code block"
                text={code}
              />
            </Box>
          </Box>
        </Box>
      </NodeViewWrapper>
    );
  },
);

CodeBlockNodeView.displayName = "CodeBlockNodeView";
