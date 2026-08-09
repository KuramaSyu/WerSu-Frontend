import { Box, ButtonBase, Paper } from "@mui/material";
import type { MinimalNote } from "../../api/models/search";
import { useThemeStore } from "../../zustand/useThemeStore";
import { ChapterRowView } from "./ChapterRowView";
import { NoteRowView } from "./NoteRowView";

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

/**
 * Renders a single clickable row in the directory view.
 *
 * Two variants:
 * - `directory`: shows a name + counts, navigates to the child directory.
 * - `note`: shows a title + truncated content, navigates to the note editor.
 *
 * Pure view rendering for each variant lives in `ChapterRowView` and
 * `NoteRowView` so the same presentation can be reused inside the chapter
 * accordion body.
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

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        textAlign: "left",
        borderRadius: 2,
        overflow: "hidden",
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
        }}
      >
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
      </Paper>
    </ButtonBase>
  );
};
