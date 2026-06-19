import { useEffect, useState } from "react";
import { EditorContext, useEditorContext } from "./Editor";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import type { Note } from "../../api/models/search";
import { useLayout } from "../../LayoutProvider";
import { NoteSidePanel } from "./NoteSidePanel";

/** sets the left panel for notes within the context of the editor */
export const LeftPanelSetter: React.FC = () => {
  const editor = useEditorContext();
  const [leftPaneOpen, setLeftPaneOpen] = useState(true);

  const { mutate } = useUpdateNote();
  const updateNote = (note: Note) => {
    mutate({ noteId: editor.noteId, title: note.title, content: note.content });
  };
  const { setLeftPanel, clearPanels } = useLayout();

  useEffect(() => {
    setLeftPanel(
      <EditorContext.Provider value={editor}>
        <NoteSidePanel
          note={editor.note}
          noteId={editor.noteId}
          open={leftPaneOpen}
          setOpen={setLeftPaneOpen}
          onNoteUpdated={updateNote}
        />
      </EditorContext.Provider>,
    );
    return () => {
      clearPanels();
    };
  }, []);

  return null;
};
