import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeProvider, type Theme } from "@mui/material/styles";
import {
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Stack,
  Typography,
} from "@mui/material";
import type { Editor } from "@tiptap/core";
import {
  type SlashCommand,
  type SlashCommandArgument,
  type SlashCommandArgumentOption,
} from "./slashCommandTypes";
import { ArgumentChip } from "./ArgumentChip";

export type SlashCommandComposerCancelReason = "dismiss" | "selection";

export interface SlashCommandComposerCallbacks {
  onExecute: (
    values: Record<string, string>,
    omittedArguments: readonly string[],
  ) => void;
  onCancel: (reason: SlashCommandComposerCancelReason) => void;
}

/**
 * Owns the ephemeral DOM node and React root for one open command
 * composer. The node is mounted as a ProseMirror widget decoration by
 * `SlashCommandComposerExtension`; disposing the controller unmounts the
 * UI and detaches all listeners.
 */
export class SlashCommandComposerController {
  readonly element: HTMLSpanElement;
  private readonly root: Root;
  private closed = false;
  private disposed = false;
  private readonly handleDocumentMouseDown: (event: MouseEvent) => void;
  private readonly handleSelectionUpdate: () => void;
  private readonly handleEditorFocus: () => void;

  constructor(
    readonly editor: Editor,
    readonly command: SlashCommand,
    readonly anchorPos: number,
    private readonly theme: Theme | undefined,
    private readonly callbacks: SlashCommandComposerCallbacks,
  ) {
    this.element = document.createElement("span");
    this.element.contentEditable = "false";
    this.element.dataset.slashCommandComposer = command.id;
    this.root = createRoot(this.element);
    // The composer lives in its own React root (it is mounted as a
    // ProseMirror widget), so it does not inherit the app's ThemeProvider
    // automatically. Pass the active theme through to keep MUI components
    // on the app's fonts/colours instead of MUI's default theme.
    const composer = <SlashCommandComposer controller={this} />;
    this.root.render(
      this.theme ? (
        <ThemeProvider theme={this.theme}>{composer}</ThemeProvider>
      ) : (
        composer
      ),
    );

    this.handleDocumentMouseDown = (event) => {
      if (this.closed) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (this.element.contains(target)) return;
      // Autocomplete suggestions are portalled outside the composer node.
      if (
        target instanceof Element &&
        target.closest("[data-slash-command-autocomplete]")
      ) {
        return;
      }
      this.cancel("selection");
    };
    this.handleSelectionUpdate = () => {
      if (this.closed) return;
      if (this.editor.state.selection.from !== this.anchorPos) {
        this.cancel("selection");
      }
    };
    // Tiptap/ProseMirror may focus the editor asynchronously (e.g. a
    // queued `editor.commands.focus(...)` animation frame), which would
    // steal focus from the argument input right after it mounted. Claim
    // it back as long as the composer is still open.
    this.handleEditorFocus = () => {
      if (this.closed || this.disposed) return;
      window.setTimeout(() => {
        if (this.closed || this.disposed) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && this.element.contains(active)) {
          return;
        }
        this.element.querySelector("input")?.focus();
      }, 0);
    };

    document.addEventListener("mousedown", this.handleDocumentMouseDown, true);
    this.editor.on("selectionUpdate", this.handleSelectionUpdate);
    this.editor.on("focus", this.handleEditorFocus);
  }

  /** Executes the command with the values currently entered in the UI. */
  execute(
    values: Record<string, string>,
    omittedArguments: readonly string[] = [],
  ): void {
    if (this.closed) return;
    this.closed = true;
    this.dispose();
    this.callbacks.onExecute(values, omittedArguments);
  }

  /**
   * Closes the composer without executing the command.
   *
   * `dismiss` means the user explicitly backed out (Escape/Backspace) and
   * the editor should regain focus; `selection` means the composer lost
   * focus because the user clicked elsewhere.
   */
  cancel(reason: SlashCommandComposerCancelReason = "dismiss"): void {
    if (this.closed) return;
    this.closed = true;
    this.dispose();
    this.callbacks.onCancel(reason);
  }

  /** Unmounts the UI without invoking callbacks (used by editor teardown). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener(
      "mousedown",
      this.handleDocumentMouseDown,
      true,
    );
    this.editor.off("selectionUpdate", this.handleSelectionUpdate);
    this.editor.off("focus", this.handleEditorFocus);
    this.root.unmount();
  }
}

interface SlashCommandComposerProps {
  controller: SlashCommandComposerController;
}

const MAX_SUGGESTIONS = 50;

/**
 * Discord-style slash-command argument composer.
 *
 * Every declared argument is rendered as a bordered chip: argument name
 * on the left with a darker background, value input on the right. The
 * currently focused argument opens an autocomplete dropdown above the
 * composer. Enter runs the command once all required arguments have a
 * value; Escape (or Backspace in an empty first argument) closes the
 * composer without running it.
 */
export const SlashCommandComposer = ({
  controller,
}: SlashCommandComposerProps) => {
  const args = useMemo(
    () => controller.command.arguments ?? [],
    [controller.command],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [removedArgs, setRemovedArgs] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [focusedName, setFocusedName] = useState<string | null>(
    args[0]?.name ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  // Async autocomplete results are kept while a new query loads, so the
  // list does not disappear/reappear (flicker) on every keystroke. Static
  // sources are filtered synchronously from render state instead.
  const [asyncSuggestions, setAsyncSuggestions] = useState<
    SlashCommandArgumentOption[]
  >([]);
  const [asyncSuggestionsLoading, setAsyncSuggestionsLoading] = useState(
    () => typeof args[0]?.autocomplete === "function",
  );
  // Name of the argument whose suggestion popup was dismissed with ESC.
  // Scoping by argument name means focusing another argument re-opens it
  // without a state-resetting effect.
  const [suggestionsDismissedFor, setSuggestionsDismissedFor] = useState<
    string | null
  >(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const includedArgs = useMemo(
    () => args.filter((argument) => !removedArgs.has(argument.name)),
    [args, removedArgs],
  );
  const focusedArg =
    includedArgs.find((argument) => argument.name === focusedName) ??
    includedArgs[0] ??
    null;
  const focusedIndex = focusedArg
    ? includedArgs.findIndex((argument) => argument.name === focusedArg.name)
    : -1;
  const query = focusedArg ? (values[focusedArg.name] ?? "") : "";
  const autocompleteSource = focusedArg?.autocomplete;
  const staticSuggestions = Array.isArray(autocompleteSource)
    ? autocompleteSource
    : null;
  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sourceOptions = staticSuggestions
      ? normalizedQuery.length > 0
        ? staticSuggestions.filter((option) =>
            `${option.value} ${option.label ?? ""}`
              .toLowerCase()
              .includes(normalizedQuery),
          )
        : staticSuggestions
      : asyncSuggestions;
    return sourceOptions.slice(0, MAX_SUGGESTIONS);
  }, [staticSuggestions, query, asyncSuggestions]);
  const suggestionsLoading = asyncSuggestionsLoading && !staticSuggestions;
  const suggestionsDismissed =
    Boolean(focusedArg) && suggestionsDismissedFor === focusedArg?.name;
  const autocompleteOpen =
    Boolean(autocompleteSource) && !suggestionsDismissed;

  // Focus (and therefore open) the active argument input. Defer by a
  // task: on first mount the composer is rendered into a widget container
  // that is inserted into the editor DOM after the React root starts, so
  // focusing synchronously would be a no-op on the detached element.
  useEffect(() => {
    const input = focusedArg
      ? inputRefs.current[focusedArg.name]
      : null;
    if (!input) return;
    const timer = window.setTimeout(() => input.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [focusedArg]);

  // Load async suggestions for the active argument. Static sources are
  // filtered synchronously above and never trigger a loading cycle.
  useEffect(() => {
    if (
      !focusedArg ||
      typeof autocompleteSource !== "function" ||
      suggestionsDismissed
    ) {
      return;
    }

    const source = autocompleteSource;
    const abortController = new AbortController();
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      setAsyncSuggestionsLoading(true);
      try {
        const loaded = await source({
          editor: controller.editor,
          command: controller.command,
          argument: focusedArg,
          query,
          values,
          signal: abortController.signal,
        });
        if (!cancelled) {
          setAsyncSuggestions(
            Array.from(loaded).slice(0, MAX_SUGGESTIONS),
          );
        }
      } catch {
        if (!cancelled) {
          setAsyncSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setAsyncSuggestionsLoading(false);
        }
      }
    };

    // Debounced so server-side searches are not fired for every keystroke.
    const timer = window.setTimeout(load, 140);
    return () => {
      cancelled = true;
      abortController.abort();
      window.clearTimeout(timer);
    };
    // `values` is included so async sources see values of other arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    focusedArg,
    autocompleteSource,
    query,
    suggestionsDismissed,
    controller.editor,
    controller.command,
  ]);

  const safeSuggestionIndex =
    suggestions.length === 0
      ? 0
      : Math.min(selectedSuggestion, suggestions.length - 1);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [safeSuggestionIndex]);

  const setValue = (name: string, value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setError(null);
    setSuggestionsDismissedFor(null);
    setSelectedSuggestion(0);
  };

  const focusArgument = (argument: SlashCommandArgument | undefined) => {
    if (!argument || argument.name === focusedArg?.name) return;
    setAsyncSuggestions([]);
    setAsyncSuggestionsLoading(
      typeof argument.autocomplete === "function",
    );
    setSelectedSuggestion(0);
    setFocusedName(argument.name);
  };

  const advance = () => {
    if (includedArgs.length === 0) return;
    const nextIndex =
      focusedIndex >= 0 ? (focusedIndex + 1) % includedArgs.length : 0;
    focusArgument(includedArgs[nextIndex]);
  };

  const chooseSuggestion = (option: SlashCommandArgumentOption | undefined) => {
    if (!option || !focusedArg) return;
    setValues((previous) => ({
      ...previous,
      [focusedArg.name]: option.value,
    }));
    setError(null);
    const nextIndex =
      focusedIndex >= 0 ? (focusedIndex + 1) % includedArgs.length : 0;
    if (includedArgs[nextIndex] && nextIndex !== focusedIndex) {
      focusArgument(includedArgs[nextIndex]);
    } else {
      setSuggestionsDismissedFor(focusedArg.name);
    }
  };

  const resolvedValue = (argument: SlashCommandArgument): string =>
    (values[argument.name]?.trim() || argument.defaultValue?.trim() || "").trim();

  const tryExecute = () => {
    const missing = includedArgs.find(
      (argument) => argument.required && !resolvedValue(argument),
    );
    if (missing) {
      setError(`Please enter a value for “${missing.name}”.`);
      focusArgument(missing);
      return;
    }
    controller.execute(values, Array.from(removedArgs));
  };

  const removeFocusedArg = () => {
    if (!focusedArg) {
      controller.cancel();
      return;
    }
    // Required arguments cannot be removed, but an empty first required
    // argument is the same as backing out of the command.
    if (focusedArg.required || includedArgs.length <= 1) {
      controller.cancel();
      return;
    }
    const previous = includedArgs[Math.max(0, focusedIndex - 1)];
    setValues((current) => {
      const next = { ...current };
      delete next[focusedArg.name];
      return next;
    });
    setRemovedArgs((current) => {
      const next = new Set(current);
      next.add(focusedArg.name);
      return next;
    });
    focusArgument(previous);
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    // Keep ProseMirror's editor keymap out of the composer input.
    event.stopPropagation();

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!autocompleteOpen) return;
      event.preventDefault();
      if (suggestions.length === 0) return;
      setSelectedSuggestion((current) =>
        event.key === "ArrowDown"
          ? (current + 1) % suggestions.length
          : (current - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (autocompleteOpen && suggestions[safeSuggestionIndex]) {
        chooseSuggestion(suggestions[safeSuggestionIndex]);
        return;
      }
      tryExecute();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      if (autocompleteOpen && suggestions[safeSuggestionIndex]) {
        chooseSuggestion(suggestions[safeSuggestionIndex]);
        return;
      }
      advance();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (autocompleteOpen) {
        setSuggestionsDismissedFor(focusedArg?.name ?? null);
        return;
      }
      controller.cancel();
      return;
    }

    if (event.key === "Backspace") {
      const input = event.currentTarget;
      if (
        query.length === 0 &&
        input.selectionStart === 0 &&
        input.selectionEnd === 0
      ) {
        event.preventDefault();
        removeFocusedArg();
      }
    }
  };

  return (
    <Stack
      component="span"
      direction="row"
      spacing={1}
      useFlexGap
      data-slash-command-composer
      onMouseDown={(event) => event.stopPropagation()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        ml: 1,
        verticalAlign: "middle",
      }}
    >
      {includedArgs.map((argument) => {
        const isFocused = argument.name === focusedArg?.name;
        return (
          <ArgumentChip
            key={argument.name}
            argument={argument}
            value={values[argument.name] ?? ""}
            focused={isFocused}
            inputRef={(input) => {
              inputRefs.current[argument.name] = input;
              if (isFocused && input) {
                setAnchorEl(input);
              }
            }}
            onChange={(value) => setValue(argument.name, value)}
            onKeyDown={handleKeyDown}
            onFocus={() => focusArgument(argument)}
            onLabelClick={() => focusArgument(argument)}
          />
        );
      })}

      {error ? (
        <Typography component="span" variant="caption" color="error">
          {error}
        </Typography>
      ) : null}

      {focusedArg?.description && !autocompleteSource ? (
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
        >
          {focusedArg.description}
        </Typography>
      ) : null}

      <Popper
        open={autocompleteOpen && Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="top-start"
        modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <Paper
          elevation={3}
          data-slash-command-autocomplete
          sx={{ minWidth: 240, maxWidth: 340, overflow: "hidden" }}
        >
          {/* Keep the argument header outside the scrolling list so
              options can never render on top of it. It is its own Paper at
              a higher elevation than the suggestion list below. */}
          <Paper
            elevation={4}
            square
            sx={{
              position: "relative",
              zIndex: 1,
              px: 2,
              pt: 1,
              pb: 0.75,
              borderBottom: 1,
              borderColor: "divider",
              lineHeight: 1.4,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {focusedArg?.name}
              {focusedArg?.required ? " *" : ""}
            </Typography>
            {focusedArg?.description ? (
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
              >
                {focusedArg.description}
              </Typography>
            ) : null}
          </Paper>
          <List
            dense
            disablePadding
            sx={{ maxHeight: 240, overflowY: "auto" }}
          >
            {suggestionsLoading && suggestions.length === 0 ? (
              <ListItemButton disabled sx={{ px: 2 }}>
                <CircularProgress size={14} sx={{ mr: 1 }} />
                <ListItemText
                  primary="Loading…"
                  slotProps={{ primary: { variant: "body2" } }}
                />
              </ListItemButton>
            ) : (
              suggestions.map((option, index) => (
                <ListItemButton
                  key={`${option.value}-${index}`}
                  ref={
                    index === safeSuggestionIndex
                      ? selectedItemRef
                      : undefined
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    chooseSuggestion(option);
                  }}
                  onMouseEnter={() => setSelectedSuggestion(index)}
                  selected={index === safeSuggestionIndex}
                  sx={{ px: 2 }}
                >
                  <ListItemText
                    primary={option.label ?? option.value}
                    secondary={option.description}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { noWrap: true },
                    }}
                  />
                </ListItemButton>
              ))
            )}
            {!suggestionsLoading && suggestions.length === 0 ? (
              <ListItemButton disabled sx={{ px: 2 }}>
                <ListItemText primary="No matches" />
              </ListItemButton>
            ) : null}
          </List>
        </Paper>
      </Popper>
    </Stack>
  );
};

export default SlashCommandComposer;
