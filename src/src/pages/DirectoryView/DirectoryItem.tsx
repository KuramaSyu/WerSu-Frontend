import { Box, ButtonBase, Checkbox, Paper, Stack } from "@mui/material";
import type { MinimalNote } from "../../api/models/search";
import { useThemeStore } from "../../zustand/useThemeStore";
import { ChapterRowView } from "./ChapterRowView";
import { NoteRowView } from "./NoteRowView";
import { useLongPress } from "../../hooks/useLongPress";
import {
  useDirectorySelectionStore,
  type SelectionEntry,
} from "../../zustand/useDirectorySelectionStore";

interface BaseProps {
  onClick: () => void;
  index: number;
}

interface DirectoryVariantProps extends BaseProps {
  variant: "directory";
  name: string;
  pages: number;
  subdirectories: number;
  directoryId: string;
}

interface NoteVariantProps extends BaseProps {
  variant: "note";
  note: MinimalNote;
}

export type DirectoryItemProps = DirectoryVariantProps | NoteVariantProps;

const DIRECTORY_COLORS = ["#C27C3B", "#3B7CC2"] as const;

const itemToEntry = (
  props: DirectoryItemProps,
): SelectionEntry =>
  props.variant === "directory"
    ? { kind: "directory", id: props.directoryId }
    : { kind: "note", id: props.note.id };

/**
 * Renders a single clickable row in the directory view.
 * Variants: directory (name + counts) or note (title + preview).
 * Long-press activates select-mode for this row.
 */
export const DirectoryItem: React.FC<DirectoryItemProps> = (props) => {
  const { onClick, index, variant } = props;
  const { theme } = useThemeStore();
  const NOTE_COLORS = [
    theme.palette.secondary.main,
    theme.blendWithContrast("secondary", 0.3),
  ] as const;

  const accentColor =
    variant === "directory"
      ? DIRECTORY_COLORS[index % DIRECTORY_COLORS.length]
      : NOTE_COLORS[index % NOTE_COLORS.length];

  const entry = itemToEntry(props);
  const active = useDirectorySelectionStore((s) => s.active);
  const isSelected = useDirectorySelectionStore((s) =>
    Boolean(s.selected[`${entry.kind}:${entry.id}`]),
  );
  const startSelection = useDirectorySelectionStore((s) => s.startSelection);
  const toggle = useDirectorySelectionStore((s) => s.toggle);

  const bindings = useLongPress({
    onLongPress: () => {
      if (!active) {
        startSelection(entry);
      } else {
        toggle(entry);
      }
    },
  });

  return (
    <ButtonBase
      {...bindings}
      onClick={() => {
        // Suppress the synthetic click that fires right after a
        // long-press release, otherwise the gesture toggles the
        // entry off immediately after selecting it.
        if (bindings.longPressFired.current) {
          return;
        }
        if (active) {
          toggle(entry);
        } else {
          onClick();
        }
      }}
      sx={{
        width: "100%",
        textAlign: "left",
        borderRadius: 2,
        overflow: "hidden",
        outline: isSelected
          ? `2px solid ${theme.palette.primary.main}`
          : "none",
        outlineOffset: -2,
        transition: (t) =>
          t.transitions.create("outline", {
            duration: t.transitions.duration.short,
          }),
      }}
    >
      <Paper
        elevation={2}
        sx={{
          display: "flex",
          alignItems: variant === "directory" ? "center" : "flex-start",
          gap: 2,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          width: "100%",
          backgroundColor: isSelected
            ? theme.elevate(theme.palette.background.paper, 6)
            : undefined,
        }}
      >
        {active && (
          <Stack
            direction="row"
            sx={{ alignItems: "center", alignSelf: "stretch" }}
          >
            <Checkbox
              edge="start"
              size="small"
              checked={isSelected}
              tabIndex={-1}
              disableRipple
              sx={{ p: 0.5 }}
              aria-label={
                variant === "directory"
                  ? "Select directory"
                  : "Select note"
              }
            />
          </Stack>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {variant === "directory" ? (
            <ChapterRowView
              name={props.name}
              pages={props.pages}
              subdirectories={props.subdirectories}
              accentColor={accentColor}
            />
          ) : (
            <NoteRowView note={props.note} accentColor={accentColor} />
          )}
        </Box>
      </Paper>
    </ButtonBase>
  );
};
