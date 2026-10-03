// ---------------------------------------------------------------------------
// FileUploadDialogController
// Owns the file-upload dialog open/close state and renders the
// UploadFileDialog. Listens to the fileDialogRequest counter for
// external opens. Lives in its own component so toggling the dialog
// does not re-render the page body.
// ---------------------------------------------------------------------------

import { memo, useEffect, useState } from "react";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { useActiveNoteStore } from "../../zustand/editorStore";
import UploadFileDialog from "./UploadSpeedDialAction";
import type { Editor } from "@tiptap/core";
import { logRerender } from "./editorRenderLog";

export interface FileUploadDialogControllerProps {
  noteId: string | undefined;
  directoryId: string | undefined;
  editor: Editor | null;
  insertAtCurrentPosition: (text: string) => void;
}

const FileUploadDialogControllerImpl: React.FC<
  FileUploadDialogControllerProps
> = ({ noteId, directoryId, editor, insertAtCurrentPosition }) => {
  logRerender("FileUploadDialogController", { hasEditor: !!editor });
  const [open, setOpen] = useState(false);

  const fileDialogRequest = useEditorMenuStore((s) => s.fileDialogRequest);

  // Translate an external request into the local open flag. The store
  // counter only increments, so this is a one-shot effect. ESLint
  // flags setState in effect; the cascade is intentional and bounded.
  useEffect(() => {
    if (fileDialogRequest > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, [fileDialogRequest]);

  const save = useActiveNoteStore((s) => s.save);

  return (
    <UploadFileDialog
      noteId={noteId!}
      directoryId={directoryId!}
      insertAtCurrentPosition={insertAtCurrentPosition}
      dialogOpen={open}
      setDialogOpen={setOpen}
      onUploadSuccess={() => save()}
      editor={editor ?? undefined}
    />
  );
};

export const FileUploadDialogController = memo(FileUploadDialogControllerImpl);
