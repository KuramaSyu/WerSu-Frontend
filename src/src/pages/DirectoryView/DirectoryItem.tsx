import { Box, ButtonBase, Typography } from "@mui/material";
import type { MinimalNote } from "../../api/models/search";
import { useThemeStore } from "../../zustand/useThemeStore";

interface BaseProps {
  onClick: () => void;
  index: number;
}

interface DirectoryVariantProps extends BaseProps {
  variant: "directory";
  name: string;
  pageCount: number;
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
 * - `directory`: shows a name + page count, navigates to the child directory.
 * - `note`: shows a title + truncated content, navigates to the note editor.
 */
export const DirectoryItem: React.FC<DirectoryItemProps> = (props) => {
  const { onClick, index, variant } = props;
  const { theme } = useThemeStore();
  const NOTE_COLORS = [
    theme.palette.secondary.main,
    theme.blendWithContrast("secondary", 0.5),
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
      <Box
        sx={{
          display: "flex",
          alignItems: variant === "directory" ? "center" : "flex-start",
          gap: 2,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: "background.paper",
          width: "100%",
        }}
      >
        <Box
          sx={{
            width: 4,
            height: "100%",
            minHeight: variant === "directory" ? 36 : 44,
            borderRadius: 999,
            backgroundColor: accentColor,
          }}
        />
        <Box sx={{ flex: 1 }}>{renderBody(props)}</Box>
      </Box>
    </ButtonBase>
  );
};

function renderBody(props: DirectoryItemProps) {
  if (props.variant === "directory") {
    return (
      <>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {props.name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {props.pageCount} Pages
        </Typography>
      </>
    );
  }

  return (
    <>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {props.note.title}
      </Typography>
      <Typography
        variant="body2"
        color="textSecondary"
        sx={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {props.note.stripped_content}
      </Typography>
    </>
  );
}
