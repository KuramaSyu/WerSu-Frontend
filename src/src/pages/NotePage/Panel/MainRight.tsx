import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { UpperPanel } from "../../../components/Panels/UpperPanel";
import { useNote } from "../../../api/queries/useNoteQueries";

export interface NoteRightPanelProps {
  noteId?: string;
}

/**
 * Right-side rail for the note page. Hosts the per-note blocks that
 * read content (attachments) and history (versions) -- the panes that
 * are most useful when the canvas is wide enough to leave them
 * visible. Mirrors the structure of `NoteLeftPanel` so both rails
 * share the spacing rhythm.
 */
export const NoteRightPanel: React.FC<NoteRightPanelProps> = ({ noteId }) => {
  const { data: note } = useNote(noteId);
  return (
    <UpperPanel spacing={2}>
      <VersionInfo noteId={noteId} />
      {note && <AttachmentPanelSection note={note} />}
    </UpperPanel>
  );
};
