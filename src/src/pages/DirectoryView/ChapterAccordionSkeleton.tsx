import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Skeleton,
  Stack,
  useTheme,
} from "@mui/material";
import { noteColors } from "./directoryAccent";
import { visibleNoteCount } from "./directoryReadme";
import { useThemeStore } from "../../zustand/useThemeStore";

interface ChapterAccordionSkeletonProps {
  /**
   * `DirectoryReply.child_note_ids` for the chapter being skeletonized.
   * The README lives at index 0 and is excluded automatically.
   */
  childNoteIds: readonly string[];
  /**
   * Number of subdirectory rows to render as skeletons.
   * Each renders a collapsed `ChapterAccordionSkeleton` so the tree depth is preserved.
   */
  subdirectoriesCount: number;
}

/**
 * Skeleton tree for `ChapterAccordion`.
 *
 * Renders the same accordion chrome (header + chevron + inner padding) as
 * the real component so layout does not shift when data arrives, then
 * fills the body with one note skeleton per entry in `childNoteIds`
 * (minus the README) and `subdirectoriesCount` collapsed sub-accordion
 * skeletons.
 *
 * The ids come from `DirectoryReply.child_note_ids` - known before the
 * detail fetch resolves - so the skeleton matches the eventual content
 * 1:1.
 */
export const ChapterAccordionSkeleton: React.FC<
  ChapterAccordionSkeletonProps
> = ({ childNoteIds, subdirectoriesCount }) => {
  const { theme } = useThemeStore();
  const [noteAccent, noteAccentAlt] = noteColors(theme);

  // Mirror the real component: drop the README from the visible count.
  const visibleNotes = visibleNoteCount(childNoteIds);

  return (
    <Accordion
      expanded
      disableGutters
      elevation={0}
      sx={{
        backgroundColor: "background.paper",
        borderRadius: 2,
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<Box sx={{ width: 24, height: 24 }} />}
        sx={{
          minHeight: 48,
          "& .MuiAccordionSummary-content": {
            my: 1.5,
            alignItems: "center",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", width: "100%", minWidth: 0 }}
        >
          <Box
            sx={{
              width: 4,
              height: 36,
              borderRadius: 999,
              backgroundColor: theme.palette.primary.main,
              flexShrink: 0,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="55%" height={24} />
            <Skeleton variant="text" width="35%" height={18} />
          </Box>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
        <Stack spacing={1}>
          {Array.from({ length: subdirectoriesCount }).map((_, i) => (
            <ChapterAccordionSkeleton
              // Subdirectory contents are not yet known - pass a
              // single-item array so the helper counts it as the
              // README (visible count = 0). The depth cue comes from
              // the collapsed accordion chrome around it.
              key={`sub-${i}`}
              childNoteIds={["__placeholder__"]}
              subdirectoriesCount={0}
            />
          ))}
          {Array.from({ length: visibleNotes }).map((_, i) => (
            <NoteRowSkeleton
              key={`note-${i}`}
              accentColor={i % 2 === 0 ? noteAccent : noteAccentAlt}
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

/** Note row skeleton mirroring `NoteRowView` (accent bar + title + preview). */
const NoteRowSkeleton: React.FC<{ accentColor: string }> = ({
  accentColor,
}) => (
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
    <Box
      sx={{
        width: 4,
        alignSelf: "stretch",
        minHeight: 44,
        borderRadius: 999,
        backgroundColor: accentColor,
        flexShrink: 0,
      }}
    />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Skeleton variant="text" width="45%" height={24} />
      <Skeleton variant="text" width="90%" height={18} />
      <Skeleton variant="text" width="70%" height={18} />
    </Box>
  </Box>
);
