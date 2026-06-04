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
import { useRef, useState } from "react";
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

      setDialogOpen(false);
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  function handleUploadClick() {
    fileInputRef.current?.click();
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
