import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { DirectoryReply } from "../../api/models/directory";
import { Crossfade } from "../../components/Crossfade";
import { Trail } from "../../components/Trail";
import { ChapterAccordionSkeleton } from "./ChapterAccordionSkeleton";
import { ChapterRowView } from "./ChapterRowView";
import { useChapterAccordion } from "./ChapterAccordion.hook";
import { NoteRowView } from "./NoteRowView";
import { useLongPress } from "../../hooks/useLongPress";
import { useDirectorySelectionStore } from "../../zustand/useDirectorySelectionStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import type { CustomThemeImpl } from "../../theme/customTheme";
import type { MinimalNote } from "../../api/models/search";
import type { UseChapterAccordionResult } from "./ChapterAccordion.hook";

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

  const { theme } = useThemeStore();
  const entry = { kind: "directory" as const, id: directory.id };
  const active = useDirectorySelectionStore((s) => s.active);
  const isSelected = useDirectorySelectionStore((s) =>
    Boolean(s.selected[`${entry.kind}:${entry.id}`]),
  );
  const startSelection = useDirectorySelectionStore((s) => s.startSelection);
  const toggle = useDirectorySelectionStore((s) => s.toggle);

  const summaryBindings = useLongPress({
    onLongPress: () => {
      if (!active) {
        startSelection(entry);
      } else {
        toggle(entry);
      }
    },
  });

  return (
    <Accordion
      expanded={expanded}
      disableGutters
      elevation={1}
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
      <AccordionSummary
        {...summaryBindings}
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
          // AccordionSummary also fires onClick on the summary row;
          // route the press through our long-press binding so the
          // single-tap / long-tap distinction matches the rest of
          // the directory view.
          if (summaryBindings.longPressFired.current) {
            return;
          }
          if (active) {
            toggle(entry);
          } else {
            onNavigate(`/d/${directory.id}`);
          }
        }}
      >
        {active && (
          <Checkbox
            edge="start"
            size="small"
            checked={isSelected}
            tabIndex={-1}
            disableRipple
            sx={{ p: 0.5, mr: 0.5 }}
            aria-label="Select directory"
          />
        )}
        <ChapterRowView
          name={
            hydratedDirectory.display_name ??
            hydratedDirectory.name ??
            hydratedDirectory.slug ??
            hydratedDirectory.id
          }
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
        <Crossfade
          loading={isLoading}
          loadingChildren={
            <ChapterAccordionSkeleton
              notesCount={hydratedDirectory.child_note_ids?.length ?? 0}
              subdirectoriesCount={hydratedDirectory.child_dir_ids?.length ?? 0}
            />
          }
        >
          {showEmptyState && (
            <Typography variant="body2" color="textSecondary">
              This chapter is empty.
            </Typography>
          )}
          {!showEmptyState && (
            <AnimatedTrailBody
              key={`${subdirectories.length}-${notes.length}`}
              subdirectories={subdirectories}
              notes={notes}
              noteAccent={noteAccent}
              noteAccentAlt={noteAccentAlt}
              onNavigate={onNavigate}
            />
          )}
        </Crossfade>
      </AccordionDetails>
    </Accordion>
  );
};

interface TrailBodyProps {
  subdirectories: DirectoryReply[];
  notes: UseChapterAccordionResult["notes"];
  noteAccent: string;
  noteAccentAlt: string;
  onNavigate: (path: string) => void;
}

const AnimatedTrailBody: React.FC<TrailBodyProps> = ({
  subdirectories,
  notes,
  noteAccent,
  noteAccentAlt,
  onNavigate,
}) => {
  const [notesReady, setNotesReady] = useState(subdirectories.length === 0);
  const { theme } = useThemeStore();
  const active = useDirectorySelectionStore((s) => s.active);

  return (
    <>
      {subdirectories.length > 0 && (
        <Trail
          key={`dirs-${subdirectories.length}`}
          onRest={() => setNotesReady(true)}
        >
          {subdirectories.map((sub) => (
            <ChapterAccordion
              key={sub.id}
              directory={sub}
              index={0}
              onNavigate={onNavigate}
            />
          ))}
        </Trail>
      )}
      {notesReady && notes.length > 0 && (
        <Trail key={`notes-${notes.length}-${subdirectories.length}`}>
          {notes.map((note) => (
            <NoteRowWithSelection
              key={note.id}
              note={note}
              noteAccent={noteAccent}
              noteAccentAlt={noteAccentAlt}
              onNavigate={onNavigate}
              showCheckbox={active}
              theme={theme}
              notes={notes}
            />
          ))}
        </Trail>
      )}
    </>
  );
};

const NoteRowWithSelection: React.FC<{
  note: MinimalNote;
  noteAccent: string;
  noteAccentAlt: string;
  onNavigate: (path: string) => void;
  showCheckbox: boolean;
  theme: CustomThemeImpl;
  notes: UseChapterAccordionResult["notes"];
}> = ({
  note,
  noteAccent,
  noteAccentAlt,
  onNavigate,
  showCheckbox,
  theme,
  notes,
}) => {
  const entry = { kind: "note" as const, id: note.id };
  const isSelected = useDirectorySelectionStore((s) =>
    Boolean(s.selected[`${entry.kind}:${entry.id}`]),
  );
  const startSelection = useDirectorySelectionStore((s) => s.startSelection);
  const toggle = useDirectorySelectionStore((s) => s.toggle);
  const active = useDirectorySelectionStore((s) => s.active);

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
    <Box
      {...bindings}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (bindings.longPressFired.current) {
          return;
        }
        if (active) {
          toggle(entry);
        } else {
          onNavigate(`/n/${note.id}`);
        }
      }}
      sx={{
        width: "100%",
        borderRadius: 2,
        overflow: "hidden",
        outline: isSelected
          ? `2px solid ${theme.palette.primary.main}`
          : "none",
        outlineOffset: -2,
        cursor: "pointer",
        transition: (t) =>
          t.transitions.create("outline", {
            duration: t.transitions.duration.short,
          }),
      }}
    >
      <Paper
        elevation={3}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          px: 2,
          py: 1,
          my: 0.5,
          width: "100%",
          borderRadius: 2,
          minWidth: 0,
          backgroundColor: isSelected
            ? theme.elevate(theme.palette.background.paper, 6)
            : undefined,
        }}
      >
        {showCheckbox && (
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
              aria-label="Select note"
            />
          </Stack>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NoteRowView
            note={note}
            accentColor={
              notes.indexOf(note) % 2 === 0 ? noteAccent : noteAccentAlt
            }
            compact
          />
        </Box>
      </Paper>
    </Box>
  );
};
