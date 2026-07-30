import { Note } from "../../../api/models/search";
import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { UpperPanel } from "../../../components/Panels/UpperPanel";

export interface NoteRightPanelProps {
  note?: Note;
  noteId?: string;
}

/**
 * Right-side rail for the note page. Hosts the per-note blocks that
 * read content (attachments) and history (versions) -- the panes that
 * are most useful when the canvas is wide enough to leave them
 * visible. Mirrors the structure of `NoteLeftPanel` so both rails
 * share the spacing rhythm.
 */
export const NoteRightPanel: React.FC<NoteRightPanelProps> = ({
  note,
  noteId,
}) => {
  return (
    <UpperPanel spacing={2}>
      {note && <AttachmentPanelSection note={note} />}
      <VersionInfo noteId={noteId} />
    </UpperPanel>
  );
};
