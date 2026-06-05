import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  SpeedDialAction,
  Typography,
} from "@mui/material";
import { useCallback, useRef, useState } from "react";
import { AttachmentApi } from "../../api/AttachmentApi";
import type {
  AttachmentLinkBody,
  CreateAttachmentBody,
} from "../../api/models/attachment";
import type { Editor } from "@tiptap/core";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";

export interface ImageUploadProps {
  editor: Editor;
  directoryId: string;
  noteId: string;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}
export default function UploadFileDialog({
  editor,
  directoryId,
  noteId,
  dialogOpen,
  setDialogOpen,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { setMessage } = useInfoStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // modal state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  /**
   * Uploads the provided file to the server, links it to the current note, and
   * inserts an image block with the uploaded image into the editor at the current
   * focus position
   * @param file the file to upload
   */
  const uploadFile = async (file: File) => {
    try {
      setUploading(true);

      const api = new AttachmentApi();

      const attachmentResponse = await api.createAttachment(file);

      if (!attachmentResponse) {
        setMessage(
          new SnackbarUpdateImpl("Failed to create attachment", "error"),
        );
        return;
      }

      const success = await api.linkAttachment({
        attachment_key: attachmentResponse.key,
        note_id: noteId,
      });

      if (!success) {
        setMessage(
          new SnackbarUpdateImpl("Failed to link attachment", "error"),
        );
        return;
      }

      setMessage(
        new SnackbarUpdateImpl("Image uploaded successfully", "success"),
      );

      // insert image block into editor
      // maybe a builder whould be better where
      const imageUrl = api.generateImageLink(
        attachmentResponse.key,
        null,
        null,
        null,
      );
      editor.chain().focus().setImage({ src: imageUrl }).run();

      // close dialog and reset state
      setDialogOpen(false);
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  /**
   * callback for add image button, which adds an image block with the provided
   * URL to the current editors focus position
   */
  const addImage = useCallback(() => {
    const url = window.prompt("URL");

    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Image</DialogTitle>

        <DialogContent>
          <Box
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            sx={{
              mt: 1,
              p: 4,
              border: "2px dashed",
              borderColor: dragging ? "primary.main" : "divider",
              borderRadius: 2,
              textAlign: "center",
              cursor: "pointer",
              transition: "all .2s",
            }}
          >
            <Typography variant="h6">Drag an image here</Typography>

            <Typography variant="body2" color="text.secondary">
              or click to browse
            </Typography>

            {selectedFile && (
              <Typography sx={{ mt: 2 }}>{selectedFile.name}</Typography>
            )}

            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>

          <Button
            variant="contained"
            disabled={!selectedFile || uploading}
            onClick={() => {
              if (selectedFile) {
                uploadFile(selectedFile);
              }
            }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
