import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { UpperPanel } from "../../../components/Panels/UpperPanel";
import { useNote } from "../../../api/queries/useNoteQueries";
import { NoteRightPanelHeader } from "./NoteRightPanelHeader";
import { Box } from "@mui/material";

export interface NoteRightPanelProps {
  noteId?: string;
}

/**
 * Right-side rail for the note page. Hosts the action header
 * (Save / Share / overflow) at the top, then the per-note blocks
 * that read content (attachments) and history (versions) -- the
 * panes that are most useful when the canvas is wide enough to
 * leave them visible. Mirrors the structure of `NoteLeftPanel`
 * so both rails share the spacing rhythm.
 */
export const NoteRightPanel: React.FC<NoteRightPanelProps> = ({ noteId }) => {
  const { data: note } = useNote(noteId);
  return (
    <UpperPanel spacing={3} variant="outlined">
      <NoteRightPanelHeader />
      <Box>
        <VersionInfo noteId={noteId} />
      </Box>
      <Box>{note && <AttachmentPanelSection note={note} />}</Box>
    </UpperPanel>
  );
};
