import {
  createElement,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { CopyButton } from "../../CopyButton";
import { SUPPORTED_LANGUAGES } from "../lowlight";
import { isMermaidLanguage } from "../mermaid/mermaidBlock";
import { syncCaretAfterPreviewResize } from "../mermaid/mermaidPreviewResize";
import { MermaidPreview } from "./MermaidPreview";

// Shared metrics so the line-number gutter and the code content always sit
// on the same baseline grid. Applied to both the `<pre>` and the gutter.
const CODE_FONT_FAMILY = "'JetBrains Mono', monospace";
const CODE_FONT_SIZE = "0.8rem";
const CODE_LINE_HEIGHT = 1.5;

// `NodeViewContent` is a generic *function*, not a generic component, so
// `<NodeViewContent<"pre" />` and `<NodeViewContent as="pre" />` both
// fall back to the default host tag of "div" at runtime. Use `createElement`
// to bypass JSX's type-parameter inference and pass `as="pre"` explicitly so
// the rendered element is actually a `<pre>`.
const PreContent: React.FC = () =>
  createElement(NodeViewContent, { as: "pre" as const });

/**
 * Count how many visual rows a single logical line spans. Falls back to
 * one row when the environment has no layout engine (e.g. jsdom).
 */
const countRenderedRows = (
  start: { node: Node; offset: number },
  end: { node: Node; offset: number },
): number => {
  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    // Inline spans can yield more than one rect per visual row, so count
    // distinct row tops rather than raw rect count.
    const tops = new Set(
      Array.from(range.getClientRects()).map((rect) => Math.round(rect.top)),
    );
    return Math.max(1, tops.size);
  } catch {
    return 1;
  }
};

/**
 * Map a global character offset in the code text to a concrete text
 * node/offset pair. Syntax highlighting splits a block into many
 * spans, so a logical line is rarely a single text node.
 */
const locateTextOffset = (
  root: Node,
  target: number,
): { node: Node; offset: number } | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = target;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
    node = walker.nextNode();
  }
  return null;
};

/**
 * Code-block node view: adds a top-right toolbar with a language
 * picker and copy button. Toolbar is `contentEditable={false}` so
 * clicks don't move the caret into the controls.
 *
 * A code block whose language is "mermaid" additionally renders a live
 * diagram preview *below* the source (see `MermaidPreview`). The preview
 * must not sit above the caret: it is rendered asynchronously, and a
 * height change above an active selection makes browsers (Firefox in
 * particular) keep painting the caret at its previous screen position.
 * Below the source, the code being edited never moves.
 *
 * The source row stays mounted so the block is still editable; in
 * read-only mode it is only hidden, never unmounted, for the same reason.
 */
export const CodeBlockNodeView: React.FC<NodeViewProps> = memo(
  ({ node, updateAttributes, editor }) => {
    const language: string = node.attrs.language ?? "plaintext";
    const code = useMemo(() => node.textContent, [node]);
    const lines = useMemo(() => code.split("\n"), [code]);
    const isSingleLine = lines.length <= 1;
    const isMermaid = isMermaidLanguage(language);
    const muiTheme = useTheme();
    // Mermaid has its own theme scale; map the app's palette mode onto the
    // nearest mermaid variant so the diagram never sits on a clashing
    // background.
    const previewTheme = muiTheme.palette.mode === "dark" ? "dark" : "default";
    // `useEditorState` only listens to ProseMirror transactions, but
    // `editor.setEditable(...)` emits an `update` event without a
    // transaction. Subscribe to both so toggling view/edit mode flips
    // the gutter immediately.
    const [isEditable, setIsEditable] = useState(editor.isEditable);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const previewContainerRef = useRef<HTMLDivElement | null>(null);
    // Number of rendered rows each logical line occupies. Lines wider than
    // the block wrap, so a line can span more than one row and its gutter
    // cell must grow to keep the following numbers aligned.
    const [lineRowCounts, setLineRowCounts] = useState<number[]>([]);

    useEffect(() => {
      const sync = () => setIsEditable(editor.isEditable);
      sync();
      editor.on("update", sync);
      editor.on("transaction", sync);
      return () => {
        editor.off("update", sync);
        editor.off("transaction", sync);
      };
    }, [editor]);

    useEffect(() => {
      if (isEditable) return;
      const container = containerRef.current;
      const content = container?.querySelector<HTMLElement>(
        "[data-node-view-content-react]",
      );
      if (!content) return;

      const measure = () => {
        const counts: number[] = [];
        let offset = 0;
        for (const line of lines) {
          // An empty line still renders as a single (blank) row.
          if (line.length === 0) {
            counts.push(1);
          } else {
            const start = locateTextOffset(content, offset);
            const end = locateTextOffset(content, offset + line.length);
            if (!start || !end) {
              counts.push(1);
            } else {
              counts.push(countRenderedRows(start, end));
            }
          }
          offset += line.length + 1;
        }
        setLineRowCounts((previous) =>
          previous.length === counts.length &&
          previous.every((count, index) => count === counts[index])
            ? previous
            : counts,
        );
      };

      // Measure after layout so the rendered rows are final.
      const frame = window.requestAnimationFrame(measure);
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(measure);
      observer?.observe(content);
      return () => {
        window.cancelAnimationFrame(frame);
        observer?.disconnect();
      };
    }, [lines, isEditable]);

    // The preview renders asynchronously. It sits below the source, so the
    // code being edited never moves - but anything *below* the diagram does,
    // and a caret sitting there can be left painted at its old position.
    // Observe the box and re-write the DOM selection on each real size change
    // (see mermaidPreviewResize.ts).
    useEffect(() => {
      const element = previewContainerRef.current;
      if (!isMermaid || !element || typeof ResizeObserver === "undefined") {
        return;
      }

      let lastHeight = element.getBoundingClientRect().height;
      const observer = new ResizeObserver((entries) => {
        const height =
          entries[0]?.contentRect.height ??
          element.getBoundingClientRect().height;
        // Sub-pixel noise would only cause pointless selection rewrites.
        if (Math.abs(height - lastHeight) < 1) return;
        lastHeight = height;
        syncCaretAfterPreviewResize(editor);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [editor, isMermaid]);

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
          ref={containerRef}
          sx={{
            backgroundColor: (theme) => theme.palette.background.default,
            p: 1,
            // Extra breathing room below the code block. A diagram follows
            // immediately below, so it only needs a small gap.
            mb: isMermaid ? 1 : 2,
            borderRadius: 2,
            // Anchor the absolute toolbar (language picker / copy button) to
            // this row instead of the node wrapper.
            position: "relative",
            // A read-only diagram's source is noise next to the rendered
            // picture, so hide the row - but keep it mounted (hidden via
            // `display`, not unmounted) so view/collaboration state and the
            // node's contentDOM are untouched.
            display: isMermaid && !isEditable ? "none" : "flex",
            alignItems: "flex-start",
            // Guarantee the code and the gutter share a baseline grid.
            "& pre": {
              flex: 1,
              minWidth: 0,
              m: 0,
              overflowX: "auto",
              fontFamily: CODE_FONT_FAMILY,
              fontSize: CODE_FONT_SIZE,
              lineHeight: CODE_LINE_HEIGHT,
              // Leave Tiptap's inline `white-space: pre-wrap` in place so
              // long lines keep wrapping exactly as they did before.
            },
          }}
        >
          {!isEditable && lines.length > 0 && (
            <Box
              component="div"
              contentEditable={false}
              aria-hidden="true"
              data-line-numbers=""
              sx={(theme) => ({
                flexShrink: 0,
                userSelect: "none",
                textAlign: "right",
                fontFamily: CODE_FONT_FAMILY,
                fontSize: CODE_FONT_SIZE,
                lineHeight: CODE_LINE_HEIGHT,
                color: theme.palette.text.disabled,
                pr: 1,
                mr: 1,
                borderRight: `1px solid ${theme.palette.divider}`,
              })}
            >
              {lines.map((_line, index) => (
                <div
                  key={index}
                  style={
                    lineRowCounts[index]
                      ? {
                          height: `calc(${lineRowCounts[index]} * ${CODE_LINE_HEIGHT}em)`,
                        }
                      : undefined
                  }
                >
                  {index + 1}
                </div>
              ))}
            </Box>
          )}
          <PreContent />
          <Box
            contentEditable={false}
            data-code-toolbar=""
            data-single-line={isSingleLine ? "" : undefined}
            sx={(theme) => ({
              position: "absolute",
              // For a single line, center the controls on the code row
              // instead of pinning them to the top edge.
              ...(isSingleLine
                ? { top: "50%", transform: "translateY(-50%)" }
                : { top: theme.spacing(0.5) }),
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
        {isMermaid && (
          <Box
            ref={previewContainerRef}
            contentEditable={false}
            data-mermaid-preview-container=""
            sx={(theme) => ({
              backgroundColor: theme.palette.background.default,
              mt: 1,
              mb: 2,
              p: 1,
              borderRadius: 2,
              overflowX: "auto",
            })}
          >
            <MermaidPreview code={code} theme={previewTheme} />
          </Box>
        )}
      </NodeViewWrapper>
    );
  },
);

CodeBlockNodeView.displayName = "CodeBlockNodeView";
