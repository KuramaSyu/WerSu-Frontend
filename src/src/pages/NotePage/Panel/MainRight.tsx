import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { UpperPanel } from "../../../components/Panels/UpperPanel";
import { FormattingPanel } from "../../../components/Editor/FormattingPanel";
import { useNote } from "../../../api/queries/useNoteQueries";

export interface NoteRightPanelProps {
  noteId?: string;
}

/**
 * Right-side rail for the note page. The Save/Share/overflow
 * toolbar lives in the desktop top bar instead (registered via
 * `useTopBarStore`); this rail only hosts the content panels.
 * Mirrors the structure of `NoteLeftPanel` so both rails share
 * the spacing rhythm.
 *
 * The rail shell paints no surface of its own; each section renders as
 * its own thin-outlined, transparent card over the page background via
 * `PanelSection`'s `bordered` prop.
 */
export const NoteRightPanel: React.FC<NoteRightPanelProps> = ({ noteId }) => {
  const { data: note } = useNote(noteId);
  return (
    <UpperPanel spacing={3}>
      <FormattingPanel />
      <VersionInfo noteId={noteId} />
      {note && <AttachmentPanelSection note={note} />}
    </UpperPanel>
  );
};
