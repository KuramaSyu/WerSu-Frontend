import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  ButtonBase,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { DirectoryReply } from "../../api/models/directory";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectoryNotesQuery } from "../../api/queries/useDirectoryNotesQuery";
import { ChapterRowView } from "./ChapterRowView";
import { NoteRowView } from "./NoteRowView";

interface ChapterAccordionProps {
  /** Directory reply backing this chapter row. */
  directory: DirectoryReply;
  /** Index into the chapter list, drives the accent color at this level. */
  index: number;
  /** Navigation handler used when the user opens the chapter or a child row. */
  onNavigate: (path: string) => void;
}

const DIRECTORY_COLORS = ["#C27C3B", "#3B7CC2"] as const;
const NESTED_ACCENT_COLOR = "#3B7CC2";

/**
 * Renders a chapter directory as a MUI Accordion.
 * The Accordion can get expanded and it can also be clicked to navigate to the chapter page.
 */
export const ChapterAccordion: React.FC<ChapterAccordionProps> = ({
  directory,
  index,
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Lazy fetch - enabled only after the user expands the accordion for the
  // first time. React Query still dedupes by queryKey on subsequent opens.
  const subdirectoriesQuery = useDirectoriesQuery(
    { parent_id: directory.id, limit: 500, offset: 0 },
    expanded,
  );

  const notesQuery = useDirectoryNotesQuery(
    expanded ? directory.id : undefined,
    { limit: 500, offset: 0 },
  );

  const accentColor = DIRECTORY_COLORS[index % DIRECTORY_COLORS.length];

  const subdirectories = subdirectoriesQuery.data ?? [];
  const notes = (notesQuery.data?.notes ?? []).filter(
    (note) => note.title !== "README.md",
  );
  const isLoading =
    expanded && (subdirectoriesQuery.isLoading || notesQuery.isLoading);
  const isEmpty =
    !isLoading && subdirectories.length === 0 && notes.length === 0;

  const handleOpenChapter = () => onNavigate(`/d/${directory.id}`);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      elevation={0}
      slotProps={{
        transition: { unmountOnExit: true },
      }}
      sx={{
        backgroundColor: "background.paper",
        borderRadius: 2,
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        onClick={(e) => {
          // Click on the expand chevron (or its enlarged hit area): expand/collapse the accordion
          // Click the body: navigate to the chapter.
          const target = e.target as HTMLElement;
          if (target.closest(".MuiAccordionSummary-expandIconWrapper")) {
            setExpanded(!expanded);
            return;
          }
          // Click anywhere else on the row navigates to the chapter.
          handleOpenChapter();
        }}
        slotProps={{
          expandIconWrapper: {
            // Enlarge the click target around the chevron, so
            // that it's easier to click
            sx: {
              p: 1.5,
              ml: 1,
              mr: -1.5,
            },
          },
        }}
        sx={{
          minHeight: 48,
          "& .MuiAccordionSummary-content": {
            my: 1.5,
            alignItems: "center",
          },
          "& .MuiAccordionSummary-content.Mui-expanded": {
            my: 1.5,
          },
        }}
      >
        <ChapterRowView
          name={
            directory.display_name ??
            directory.name ??
            directory.slug ??
            directory.id
          }
          pages={directory.child_note_ids?.length ?? 0}
          subdirectories={directory.child_dir_ids?.length ?? 0}
          accentColor={accentColor}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
        {isLoading && (
          <Stack
            direction="row"
            sx={{ justifyContent: "center", py: 2 }}
            aria-label="loading chapter contents"
          >
            <CircularProgress size={24} />
          </Stack>
        )}
        {!isLoading && isEmpty && (
          <Typography variant="body2" color="textSecondary">
            This chapter is empty.
          </Typography>
        )}
        {!isLoading && !isEmpty && (
          <Stack spacing={1}>
            {subdirectories.map((sub) => (
              <ChapterAccordion
                key={sub.id}
                directory={sub}
                index={0}
                onNavigate={onNavigate}
              />
            ))}
            {notes.map((note) => (
              <ButtonBase
                key={note.id}
                onClick={() => onNavigate(`/n/${note.id}`)}
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
                    alignItems: "flex-start",
                    gap: 2,
                    px: 2,
                    py: 1.25,
                    width: "100%",
                    borderRadius: 2,
                    backgroundColor: "background.paper",
                  }}
                >
                  <NoteRowView
                    note={note}
                    accentColor={NESTED_ACCENT_COLOR}
                    compact
                  />
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
};
