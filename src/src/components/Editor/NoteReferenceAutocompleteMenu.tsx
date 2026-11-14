import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEditorState } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { useQuery } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import type { MinimalNote } from "../../api/models/search";
import { RestNotesSearchType } from "../../api/models/search";
import { getSearchNotesApi } from "../../api/SearchNotesApi";
import {
  getNoteReferenceAutocompleteContext,
  insertNoteReferenceFromAutocomplete,
  isNoteReferenceAutocompleteOpen,
  noteReferenceAutocompleteFloatingKey,
} from "./NoteReferenceAutocomplete";

export interface NoteReferenceAutocompleteMenuProps {
  editor: Editor;
  enabled?: boolean;
}

const SEARCH_LIMIT = 8;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === debounced) return;
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs, debounced]);
  return debounced;
}

const searchNotesApi = getSearchNotesApi();

/**
 * Note search dropdown for `{{query}}` autocomplete. Selection replaces
 * the whole brace block with a `noteReference` atom; the menu itself
 * never changes the surrounding prose.
 */
export const NoteReferenceAutocompleteMenu = ({
  editor,
  enabled = true,
}: NoteReferenceAutocompleteMenuProps) => {
  const { context, isOpen } = useEditorState({
    editor,
    selector: (ctx) => ({
      context: getNoteReferenceAutocompleteContext(ctx.editor),
      isOpen: isNoteReferenceAutocompleteOpen(ctx.editor),
    }),
  });

  const rawQuery = context?.searchQuery.trim() ?? "";
  const debouncedQuery = useDebouncedValue(rawQuery, 180);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: notes = [], isFetching } = useQuery({
    queryKey: [
      "notes",
      "reference-autocomplete",
      RestNotesSearchType.TYPO_TOLERANT,
      debouncedQuery,
      SEARCH_LIMIT,
    ],
    queryFn: async (): Promise<MinimalNote[]> => {
      const reply = await searchNotesApi.search(
        RestNotesSearchType.TYPO_TOLERANT,
        debouncedQuery,
        { limit: SEARCH_LIMIT, offset: 0 },
      );
      return reply.notes;
    },
    enabled: enabled && isOpen && debouncedQuery.length > 0,
  });

  const options = useMemo(() => notes.slice(0, SEARCH_LIMIT), [notes]);
  // Clamp during render instead of resetting via an effect, so the
  // highlighted row always points at a real option.
  const safeIndex =
    options.length === 0 ? 0 : Math.min(selectedIndex, options.length - 1);

  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  const choose = (note: MinimalNote | undefined) => {
    if (!note || !context) return;
    insertNoteReferenceFromAutocomplete(editor, context, note.id);
    setSelectedIndex(0);
  };

  useEffect(() => {
    if (!editor.view || editor.isDestroyed) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled || !editor.isEditable || !isOpen) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          options.length === 0
            ? 0
            : Math.min(prev + 1, options.length - 1),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const option = options[safeIndex];
        if (!option) return;
        event.preventDefault();
        choose(option);
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (editor.view && !editor.isDestroyed) {
        editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
      }
    };
    // `choose` is intentionally derived from the current render; the
    // effect already re-binds whenever the highlighted option changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, enabled, isOpen, options, safeIndex, context]);

  return (
    <FloatingMenu
      editor={editor}
      pluginKey={noteReferenceAutocompleteFloatingKey}
      options={{ placement: "bottom-start", offset: 6, flip: true }}
      shouldShow={() =>
        enabled && editor.isEditable && isNoteReferenceAutocompleteOpen(editor)
      }
    >
      <Paper elevation={1} sx={{ minWidth: 280, maxWidth: 380, py: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ px: 2, pb: 1, textTransform: "uppercase" }}
        >
          Link note
        </Typography>

        {rawQuery.length === 0 ? (
          <Typography variant="body2" color="textSecondary" sx={{ px: 2 }}>
            Type a note title or id to search.
          </Typography>
        ) : isFetching && options.length === 0 ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ px: 2, py: 1, alignItems: "center" }}
          >
            <CircularProgress size={14} />
            <Typography variant="body2" color="textSecondary">
              Searching notes...
            </Typography>
          </Stack>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 300, overflowY: "auto" }}>
            {options.map((note, index) => (
              <ListItemButton
                key={note.id}
                ref={index === safeIndex ? selectedItemRef : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(note);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                sx={{
                  px: 0,
                  backgroundColor:
                    index === safeIndex ? "action.selected" : undefined,
                }}
              >
                <ListItemText
                  sx={{ px: 2, m: 0 }}
                  primary={note.title || "(Untitled note)"}
                  slotProps={{
                    primary: { noWrap: true },
                  }}
                />
              </ListItemButton>
            ))}
            {options.length === 0 && !isFetching && (
              <ListItemButton disabled>
                <ListItemText primary="No notes found" />
              </ListItemButton>
            )}
          </List>
        )}
      </Paper>
    </FloatingMenu>
  );
};

export default NoteReferenceAutocompleteMenu;