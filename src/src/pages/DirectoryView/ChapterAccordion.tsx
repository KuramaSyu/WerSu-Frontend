import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  ButtonBase,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { DirectoryReply } from "../../api/models/directory";
import { ChapterAccordionSkeleton } from "./ChapterAccordionSkeleton";
import { ChapterRowView } from "./ChapterRowView";
import { useChapterAccordion } from "./ChapterAccordion.hook";
import { NoteRowView } from "./NoteRowView";

interface ChapterAccordionProps {
  /** Directory reply backing this chapter row. */
  directory: DirectoryReply;
  /** Index into the chapter list, drives the accent color at this level. */
  index: number;
  /** Navigation handler used when the user opens the chapter or a child row. */
  onNavigate: (path: string) => void;
}

/**
 * Renders a chapter directory as a MUI Accordion.
 * The Accordion can get expanded and it can also be clicked to navigate to the chapter page.
 *
 * All non-render logic (hydration, expansion state, body data,
 * derivations, accent color) lives in `useChapterAccordion`.
 */
export const ChapterAccordion: React.FC<ChapterAccordionProps> = ({
  directory,
  index,
  onNavigate,
}) => {
  const {
    hydratedDirectory,
    expanded,
    toggleExpanded,
    markCloseAnimationCompleted,
    markOpenAnimationStarted,
    subdirectories,
    notes,
    isLoading,
    showEmptyState,
    accentColor,
    noteAccent,
    noteAccentAlt,
  } = useChapterAccordion(directory, index);

  const handleOpenChapter = () => onNavigate(`/d/${directory.id}`);

  return (
    <Accordion
      expanded={expanded}
      disableGutters
      elevation={0}
      slotProps={{
        transition: {
          unmountOnExit: true,
          // Mark the close animation as completed so the empty-state
          // can render once the body has fully unmounted; clear the
          // flag on the next open so future closes re-trigger the gate.
          onExited: () => markCloseAnimationCompleted(),
          onEnter: () => markOpenAnimationStarted(),
        },
      }}
      sx={{
        backgroundColor: "background.paper",
        borderRadius: 2,
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={
          <ExpandMoreIcon
            onClick={toggleExpanded}
            sx={{
              // enlarge click area of the chevron, so that it's easier to click
              p: 1.5,
              borderRadius: 100,
              "&:hover": { backgroundColor: "action.hover" },
              transition: (theme) =>
                theme.transitions.create("background-color", {
                  duration: theme.transitions.duration.standard,
                }),
            }}
          />
        }
        onClick={() => {
          handleOpenChapter();
        }}
      >
        <ChapterRowView
          name={
            hydratedDirectory.display_name ??
            hydratedDirectory.name ??
            hydratedDirectory.slug ??
            hydratedDirectory.id
          }
          // Subtract 1 only when the field is actually populated. Some
          // endpoints strip `child_note_ids` entirely, leaving it as
          // `[]` - subtracting 1 from 0 produces "-1 pages". Treat the
          // unknown case as "no notes" rather than a negative count.
          // The README is the first entry when present, so `>= 1` means
          // at least the README was returned.
          pages={
            hydratedDirectory.child_note_ids &&
            hydratedDirectory.child_note_ids.length >= 1
              ? hydratedDirectory.child_note_ids.length - 1
              : 0
          }
          subdirectories={hydratedDirectory.child_dir_ids?.length ?? 0}
          accentColor={accentColor}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
        {isLoading && (
          <ChapterAccordionSkeleton
            childNoteIds={hydratedDirectory.child_note_ids ?? []}
            subdirectoriesCount={hydratedDirectory.child_dir_ids?.length ?? 0}
          />
        )}
        {!isLoading && showEmptyState && (
          <Typography variant="body2" color="textSecondary">
            This chapter is empty.
          </Typography>
        )}
        {!isLoading && !showEmptyState && (
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
                    accentColor={
                      // Match the alternating note palette so nested
                      // rows visually echo the top-level `DirectoryItem`.
                      notes.indexOf(note) % 2 === 0 ? noteAccent : noteAccentAlt
                    }
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
