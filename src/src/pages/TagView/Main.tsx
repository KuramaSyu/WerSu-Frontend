import { Chip, Stack, Typography } from "@mui/material";
import { DragDropProvider } from "@dnd-kit/react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLeftPanel, usePanelSize, useRightPanel } from "../../LayoutProvider";
import { M3 } from "../../statics";
import { CardGrid } from "../MainPage/CardGrid";
import { PageSurface } from "../../components/PageSurface";
import { useTagNotesQuery, useTagQuery } from "../../api/queries/tagQueries";
import { tagLabel } from "../../api/models/tag";
import { useThemeStore } from "../../zustand/useThemeStore";
import { ACCENT_FONT_FAMILY } from "../../theme/customTheme";
import { TagLeftPanel } from "./LeftPanel";
import { TagMenu } from "./TagMenu";

/**
 * Tag page (`/t/:id`). Uses the same page shell as the directory view,
 * but lists the tagged notes as a card grid instead of the chapter /
 * note-row layout.
 */
export const TagView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tagId = id ?? "";
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  const { data: tag, isLoading: tagLoading } = useTagQuery(tagId);
  const { data: notes, isLoading: notesLoading } = useTagNotesQuery(tagId);

  const label = tagLabel(tag, tagId || "Tag");

  useRightPanel(null);
  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });
  useLeftPanel(
    <TagLeftPanel
      tag={tag}
      tagId={tagId}
      noteCount={notes?.length}
      isLoading={tagLoading}
    />,
    [tagId, tag, notes?.length, tagLoading],
  );

  const noteList = useMemo(() => notes ?? [], [notes]);

  return (
    <PageSurface>
      <Stack spacing={M3}>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="body2" color="textSecondary">
              Tags
            </Typography>
            <Typography variant="body2" color="textSecondary">
              ›
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {label}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography
              variant="h4"
              sx={{
                fontFamily:
                  theme.custom?.accentFontFamily ?? ACCENT_FONT_FAMILY,
                fontWeight: 300,
              }}
            >
              {label}
            </Typography>
            {tag?.slug && (
              <Chip size="small" variant="outlined" label={`#${tag.slug}`} />
            )}
            <TagMenu tag={tag} />
          </Stack>
        </Stack>

        {!tagLoading && !tag && (
          <Typography variant="body2" color="textSecondary">
            This tag does not exist (or you do not have access to it).
          </Typography>
        )}

        <DragDropProvider>
          <CardGrid
            bare
            title="Notes"
            notes={noteList}
            loading={tagLoading || notesLoading}
            onNoteOpen={(note) => navigate(`/n/${note.id}`)}
          />
        </DragDropProvider>
      </Stack>
    </PageSurface>
  );
};
