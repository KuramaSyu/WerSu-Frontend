import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { UpperPanel } from "../../../components/Panels/UpperPanel";
import { FormattingPanel } from "../../../components/Editor/FormattingPanel";
import { useNote } from "../../../api/queries/useNoteQueries";
import { Box } from "@mui/material";

export interface NoteRightPanelProps {
  noteId?: string;
}

/**
 * Right-side rail for the note page. The Save/Share/overflow
 * toolbar lives in the desktop top bar instead (registered via
 * `useTopBarStore`); this rail only hosts the content panels.
 * Mirrors the structure of `NoteLeftPanel` so both rails share
 * the spacing rhythm.
 */
export const NoteRightPanel: React.FC<NoteRightPanelProps> = ({ noteId }) => {
  const { data: note } = useNote(noteId);
  return (
    <UpperPanel spacing={3} variant="outlined">
      <Box>
        <FormattingPanel />
      </Box>
      <Box>
        <VersionInfo noteId={noteId} />
      </Box>
      <Box>{note && <AttachmentPanelSection note={note} />}</Box>
    </UpperPanel>
  );
};
