// ---------------------------------------------------------------------------
// FindReplaceBar
// VS Code-style find/replace widget for the note editor. Floats at the
// bottom of the viewport, is opened with Ctrl/Cmd+F (Ctrl/Cmd+H opens
// it expanded), and drives either the rich (Tiptap) or source
// (textarea) surface depending on the active view mode.
//
// Replace is intentionally disabled unless the note is editable, so
// read-only/view mode can still search but not mutate the document.
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Fade,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FindReplaceIcon from "@mui/icons-material/FindReplace";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
  IconAbc,
  IconChevronDown,
  IconChevronRight,
  IconLetterCase,
  IconLetterCaseUpper,
  IconRegex,
} from "@tabler/icons-react";
import type { Editor } from "@tiptap/core";
import {
  buildReplacementText,
  findTextMatches,
  isFindQueryValid,
  replaceAllInText,
  type FindReplaceOptions,
} from "../../components/Editor/findReplace";
import {
  clearFindReplaceState,
  findDocumentMatches,
  getFindReplaceState,
  setFindReplaceState,
  type FindReplaceState,
} from "../../components/Editor/FindReplaceExtension";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { M4, MOBILE_BOTTOM_BAR_CLEARANCE } from "../../statics";
import { useNoteFindStore } from "../../zustand/useNoteFindStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface FindReplaceBarProps {
  editor: Editor | null;
  viewMode: "source" | "rich";
  editMode: boolean;
  readOnly: boolean;
  sourceMarkdown: string;
  setSourceMarkdown: (markdown: string) => void;
}

const FIND_INPUT_WIDTH = 300;

/** Small square toggle used for the match-case / whole-word / regex flags. */
const ToolbarToggle: React.FC<{
  active: boolean;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}> = ({ active, title, disabled, onClick, children }) => (
  <Tooltip title={title}>
    <span>
      <IconButton
        size="small"
        disabled={disabled}
        aria-label={title}
        aria-pressed={active}
        onClick={onClick}
        sx={{
          p: 0.25,
          borderRadius: 0.75,
          color: active ? "primary.contrastText" : "text.secondary",
          backgroundColor: active ? "primary.main" : "transparent",
          "&:hover": {
            backgroundColor: active ? "primary.dark" : "action.hover",
          },
        }}
      >
        {children}
      </IconButton>
    </span>
  </Tooltip>
);

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  editor,
  viewMode,
  editMode,
  readOnly,
  sourceMarkdown,
  setSourceMarkdown,
}) => {
  const { theme } = useThemeStore();
  const { isMobile } = useBreakpoint();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [preserveCaseOn, setPreserveCaseOn] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [richState, setRichState] = useState<FindReplaceState | undefined>(
    undefined,
  );

  const findInputRef = useRef<HTMLInputElement | null>(null);

  const isRich = viewMode === "rich";
  const canReplace = editMode && !readOnly;

  const options = useMemo<FindReplaceOptions>(
    () => ({ caseSensitive, wholeWord, regex }),
    [caseSensitive, wholeWord, regex],
  );
  const queryValid = isFindQueryValid(query, options);

  // Mirror the ProseMirror plugin state so the match counter and
  // navigation stay in sync with document edits.
  useEffect(() => {
    if (!editor || !isRich) return;
    const sync = () => setRichState(getFindReplaceState(editor));
    sync();
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor, isRich]);

  const sourceMatches = useMemo(
    () =>
      !isRich && open ? findTextMatches(sourceMarkdown, query, options) : [],
    [isRich, open, sourceMarkdown, query, options],
  );

  const matchCount = isRich
    ? (richState?.matches.length ?? 0)
    : sourceMatches.length;
  // Derive the in-bounds active index instead of writing it back from
  // an effect when the match set shrinks under us.
  const safeActiveIndex =
    matchCount === 0 ? 0 : Math.min(activeIndex, matchCount - 1);
  const displayIndex = matchCount === 0 ? 0 : safeActiveIndex + 1;

  // Reset to the first hit whenever the search term or flags change.
  const resetActive = useCallback(() => setActiveIndex(0), []);

  // Push query/options changes into the rich editor and jump to the
  // first hit.
  useEffect(() => {
    if (!isRich || !editor || !open) return;
    setFindReplaceState(editor, { query, options, activeIndex: 0 });
    if (!query) return;
    const first = findDocumentMatches(editor.state.doc, query, options)[0];
    if (first) {
      editor.commands.setTextSelection({ from: first.from, to: first.to });
      editor.commands.scrollIntoView();
    }
  }, [editor, isRich, open, query, options]);

  // Reflect the active index into the decoration layer and clear the
  // highlights when the widget closes.
  useEffect(() => {
    if (!isRich || !editor) return;
    if (!open) {
      clearFindReplaceState(editor);
      return;
    }
    setFindReplaceState(editor, { activeIndex: safeActiveIndex });
  }, [editor, isRich, open, safeActiveIndex]);

  // Source mode: publish the matches for the source editor's overlay,
  // which paints them and scrolls the active one into view.
  useEffect(() => {
    if (isRich || !open) {
      useNoteFindStore.getState().clearHighlight();
      return;
    }
    useNoteFindStore.getState().setHighlight(
      sourceMatches.map((match) => ({ from: match.from, to: match.to })),
      safeActiveIndex,
    );
  }, [isRich, open, sourceMatches, safeActiveIndex]);

  const focusFindInput = useCallback(() => {
    requestAnimationFrame(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    });
  }, []);

  const openWidget = useCallback(
    (withReplace: boolean) => {
      setOpen(true);
      if (withReplace && canReplace) setExpanded(true);
      focusFindInput();
    },
    [canReplace, focusFindInput],
  );

  const closeWidget = useCallback(() => {
    setOpen(false);
    setExpanded(false);
  }, []);

  // Capture Ctrl/Cmd+F (and Ctrl/Cmd+H for replace) globally while the
  // note editor is mounted, and stop the browser's own find UI.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      // The global search overlay owns the keyboard while it is open.
      if (useSearchNotesStore.getState().isDialogOpen) return;
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        event.stopPropagation();
        openWidget(false);
        return;
      }
      if (key === "h" && canReplace) {
        event.preventDefault();
        event.stopPropagation();
        openWidget(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [canReplace, openWidget]);

  const goToMatch = useCallback(
    (delta: number) => {
      if (matchCount === 0) return;
      const next = (safeActiveIndex + delta + matchCount) % matchCount;
      setActiveIndex(next);
      if (isRich && editor) {
        const match = findDocumentMatches(editor.state.doc, query, options)[
          next
        ];
        if (match) {
          editor.commands.setTextSelection({ from: match.from, to: match.to });
          editor.commands.scrollIntoView();
        }
      }
    },
    [safeActiveIndex, editor, isRich, matchCount, options, query],
  );

  const replaceCurrent = useCallback(() => {
    if (!canReplace || matchCount === 0) return;
    if (isRich && editor) {
      const match = findDocumentMatches(editor.state.doc, query, options)[
        safeActiveIndex
      ];
      if (!match) return;
      const text = buildReplacementText(match, replacement, {
        ...options,
        preserveCase: preserveCaseOn,
      });
      editor
        .chain()
        .insertContentAt({ from: match.from, to: match.to }, text)
        .run();
      return;
    }
    const match = sourceMatches[safeActiveIndex];
    if (!match) return;
    const text = buildReplacementText(match, replacement, {
      ...options,
      preserveCase: preserveCaseOn,
    });
    setSourceMarkdown(
      sourceMarkdown.slice(0, match.from) + text + sourceMarkdown.slice(match.to),
    );
  }, [
    safeActiveIndex,
    canReplace,
    editor,
    isRich,
    matchCount,
    options,
    preserveCaseOn,
    query,
    replacement,
    sourceMatches,
    sourceMarkdown,
    setSourceMarkdown,
  ]);

  const replaceAll = useCallback(() => {
    if (!canReplace || matchCount === 0) return;
    if (isRich && editor) {
      const matches = findDocumentMatches(editor.state.doc, query, options);
      if (matches.length === 0) return;
      let chain = editor.chain();
      // Apply back-to-front so earlier positions stay valid.
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const match = matches[i];
        const text = buildReplacementText(match, replacement, {
          ...options,
          preserveCase: preserveCaseOn,
        });
        chain = chain.insertContentAt(
          { from: match.from, to: match.to },
          text,
        );
      }
      chain.run();
      return;
    }
    const next = replaceAllInText(sourceMarkdown, query, replacement, {
      ...options,
      preserveCase: preserveCaseOn,
    });
    if (next !== sourceMarkdown) setSourceMarkdown(next);
  }, [
    canReplace,
    editor,
    isRich,
    matchCount,
    options,
    preserveCaseOn,
    query,
    replacement,
    sourceMarkdown,
    setSourceMarkdown,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeWidget();
      return;
    }
    if (event.key === "Enter") {
      const target = event.target as HTMLElement;
      if (target === findInputRef.current) {
        event.preventDefault();
        goToMatch(event.shiftKey ? -1 : 1);
        return;
      }
      // Only the replace input should trigger a replace on Enter; leave
      // buttons to their native click activation.
      if (canReplace && target.tagName === "INPUT") {
        event.preventDefault();
        if (event.ctrlKey || event.altKey) {
          replaceAll();
        } else {
          replaceCurrent();
        }
      }
    }
  };

  const bottom = isMobile
    ? `calc(${M4} + ${MOBILE_BOTTOM_BAR_CLEARANCE})`
    : M4;

  const toggleAdornment = (
    <InputAdornment position="end">
      <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
        <ToolbarToggle
          active={caseSensitive}
          title="Match case"
          onClick={() => {
            setCaseSensitive((value) => !value);
            resetActive();
          }}
        >
          <IconLetterCase size={16} />
        </ToolbarToggle>
        <ToolbarToggle
          active={wholeWord}
          title="Match whole word"
          onClick={() => {
            setWholeWord((value) => !value);
            resetActive();
          }}
        >
          <IconAbc size={16} />
        </ToolbarToggle>
        <ToolbarToggle
          active={regex}
          title="Use regular expression"
          onClick={() => {
            setRegex((value) => !value);
            resetActive();
          }}
        >
          <IconRegex size={16} />
        </ToolbarToggle>
      </Stack>
    </InputAdornment>
  );

  return (
    <Fade in={open} unmountOnExit>
      <Paper
        elevation={8}
        onKeyDown={handleKeyDown}
        sx={{
          position: "fixed",
          bottom,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1300,
          display: "flex",
          alignItems: "flex-start",
          gap: 0.5,
          p: 0.5,
          // Follow the app theme's rounding convention (see
          // ThemedEditorBox) so the widget matches the editor chrome.
          borderRadius: theme.shape.borderRadius,
          border: 1,
          borderColor: "divider",
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <IconButton
          size="small"
          aria-label={expanded ? "Collapse replace" : "Expand replace"}
          title={expanded ? "Collapse replace" : "Expand replace"}
          disabled={!canReplace}
          onClick={() => setExpanded((value) => !value)}
          sx={{ mt: 0.25 }}
        >
          {expanded ? (
            <IconChevronDown size={18} />
          ) : (
            <IconChevronRight size={18} />
          )}
        </IconButton>

        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <TextField
              size="small"
              autoFocus
              placeholder="Find"
              value={query}
              inputRef={findInputRef}
              onChange={(event) => {
                setQuery(event.target.value);
                resetActive();
              }}
              error={!queryValid}
              sx={{
                width: FIND_INPUT_WIDTH,
                "& .MuiOutlinedInput-input": { py: 0.5 },
              }}
              slotProps={{ input: { endAdornment: toggleAdornment } }}
            />
            <Typography
              variant="caption"
              color={matchCount === 0 && query ? "error" : "text.secondary"}
              sx={{
                minWidth: "3.5rem",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {query ? `${displayIndex}/${matchCount}` : ""}
            </Typography>
            <Tooltip title="Previous match">
              <span>
                <IconButton
                  size="small"
                  aria-label="Previous match"
                  disabled={matchCount === 0}
                  onClick={() => goToMatch(-1)}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next match">
              <span>
                <IconButton
                  size="small"
                  aria-label="Next match"
                  disabled={matchCount === 0}
                  onClick={() => goToMatch(1)}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                size="small"
                aria-label="Close find"
                onClick={closeWidget}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {expanded && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: "center", pl: 0.25 }}
            >
              <TextField
                size="small"
                placeholder="Replace"
                value={replacement}
                disabled={!canReplace}
                onChange={(event) => setReplacement(event.target.value)}
                sx={{
                  width: FIND_INPUT_WIDTH,
                  "& .MuiOutlinedInput-input": { py: 0.5 },
                }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <ToolbarToggle
                          active={preserveCaseOn}
                          title="Preserve case"
                          disabled={!canReplace}
                          onClick={() => setPreserveCaseOn((value) => !value)}
                        >
                          <IconLetterCaseUpper size={16} />
                        </ToolbarToggle>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Tooltip title="Replace">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Replace"
                    disabled={!canReplace || matchCount === 0}
                    onClick={replaceCurrent}
                  >
                    <FindReplaceIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Replace all">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Replace all"
                    disabled={!canReplace || matchCount === 0}
                    onClick={replaceAll}
                  >
                    <DoneAllIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Fade>
  );
};
