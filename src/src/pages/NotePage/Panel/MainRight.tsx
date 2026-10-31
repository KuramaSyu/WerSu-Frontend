import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { UpperPanel } from "../../../components/Panels/UpperPanel";
import { RightPanelEdgeToggle } from "../../../components/Panels/RightPanelEdgeToggle";
import { FormattingPanel } from "../../../components/Editor/FormattingPanel";
import { useNote } from "../../../api/queries/useNoteQueries";
import { useEditorSettings } from "../../../zustand/useEditorSettings";

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
 *
 * The rail's collapse handle is attached to the first visible box
 * (Formatting in edit mode, Versions otherwise) so it reads as part of
 * that card, even though it collapses every box on the rail.
 */
export const NoteRightPanel: React.FC<NoteRightPanelProps> = ({ noteId }) => {
  const { data: note } = useNote(noteId);
  // Formatting renders first only while editing, so the edge handle
  // has to move with it to stay on the first box.
  const editMode = useEditorSettings((s) => s.editMode);
  const edgeHandle = <RightPanelEdgeToggle />;
  return (
    <UpperPanel spacing={3}>
      <FormattingPanel leftEdgeHandle={editMode ? edgeHandle : undefined} />
      <VersionInfo
        noteId={noteId}
        leftEdgeHandle={editMode ? undefined : edgeHandle}
      />
      {note && <AttachmentPanelSection note={note} />}
    </UpperPanel>
  );
};
