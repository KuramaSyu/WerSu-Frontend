import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { AttachmentApi, type IAttachmentApi } from "../../api/AttachmentApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";
import { getReadmePreview } from "../../utils/readme";

export interface ImageUploadModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called with the markdown image URL once the user uploads an image
   * successfully. The caller (DirectoryEdit) drops this into the directory
   * `image_url` field.
   */
  onUploaded: (markdownUrl: string) => void;
  /**
   * Current body of the README note. Rendered as a small preview so the
   * user has context for what they're attaching the image to.
   */
  readmeContent?: string;
  /**
   * The directory's current `image_url` value. Used to pre-fill the
   * preview state when the modal opens, so a previously-uploaded image is
   * visible in the drop zone immediately.
   */
  currentImageUrl?: string;
  /**
   * `getReadmeNoteId` resolves the current README note id, creating the
   * note (and assigning it to the directory) on the server if one doesn't
   * exist. The modal calls this on every upload to guarantee a stable id
   * for the `linkAttachment` step. Return `null` to abort the upload.
   *
   * The DirectoryEdit page implements this by reusing the same `post` +
   * `patchDirectory` flow it runs on save, and then updates the local
   * `readmeNoteId` state so subsequent uploads don't re-create.
   */
  getReadmeNoteId: () => Promise<string | null>;
  /**
   * When `true`, the modal skips its own upload step: the user picks a
   * file, sees a preview, and the modal calls `onFilePicked(file)`
   * instead of calling `AttachmentApi.createAttachment` itself. The
   * caller is responsible for the actual upload + linking. Used by the
   * `CreateSubdirectory` flow, which has to defer the upload until the
   * directory exists.
   */
  deferUpload?: boolean;
  /**
   * Invoked with the picked file when `deferUpload` is `true`. The
   * modal still calls this even if the user re-picks a file, so the
   * caller can hold only the most recent selection.
   */
  onFilePicked?: (file: File) => void;
  attachmentsApi?: IAttachmentApi;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const isImage = (file: File): boolean => {
  if (file.type.startsWith("image/")) {
    return true;
  }
  return ACCEPTED_TYPES.includes(file.type);
};

/**
 * Modal for picking or dragging a directory image. Uploads via
 * `AttachmentApi.createAttachment`, links the upload to the directory's
 * README note (creating the note on demand if it doesn't exist yet), and
 * returns the markdown image URL (`![...](url)`) the caller writes into
 * the directory `image_url` field.
 */
export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  open,
  onClose,
  onUploaded,
  readmeContent,
  currentImageUrl,
  getReadmeNoteId,
  deferUpload,
  onFilePicked,
  attachmentsApi,
}) => {
  const api = attachmentsApi ?? new AttachmentApi();
  const { setMessage } = useInfoStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Build a stable object URL for the picked file. Revoke on change / close
  // so we don't leak the underlying Blob between selections.
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Reset transient state when the modal closes so the next open is clean.
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setDragging(false);
      setUploading(false);
    }
  }, [open]);

  // Show the existing directory image as the initial preview when the
  // modal opens, until the user picks a new file.
  const initialPreview = useMemo(() => {
    if (selectedFile || !currentImageUrl) {
      return null;
    }
    return currentImageUrl;
  }, [currentImageUrl, selectedFile]);

  const readmePreview = useMemo(
    () => getReadmePreview(readmeContent),
    [readmeContent],
  );

  const pickFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!isImage(file)) {
      setMessage(
        new SnackbarUpdateImpl(
          "Please pick an image file (png, jpeg, webp, gif).",
          "warning",
        ),
      );
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }
    // Deferred-upload mode: hand the file back to the caller and let
    // them drive the actual upload + README linking. The caller is
    // expected to close the modal on success.
    if (deferUpload) {
      onFilePicked?.(selectedFile);
      onClose();
      return;
    }
    setUploading(true);
    try {
      // 1. Resolve the README note id. The owner creates the note (and
      //    assigns it to this directory) on the server if it doesn't
      //    exist yet. Abort cleanly if the owner can't resolve an id.
      const readmeNoteId = await getReadmeNoteId();
      if (!readmeNoteId) {
        setMessage(
          new SnackbarUpdateImpl(
            "Failed to resolve the directory's README note",
            "error",
          ),
        );
        return;
      }

      // 2. Upload the image to attachment storage.
      const metadata = await api.createAttachment(selectedFile);
      if (!metadata) {
        setMessage(new SnackbarUpdateImpl("Image upload failed", "error"));
        return;
      }

      // 3. Link the attachment to the README note. The asset shows up in
      //    the note's attachment list and is reachable through the note's
      //    permission graph.
      const linked = await api.linkAttachment({
        attachment_key: metadata.key,
        note_id: readmeNoteId,
      });
      if (linked === null) {
        setMessage(
          new SnackbarUpdateImpl(
            "Image uploaded, but failed to link it to the README note",
            "warning",
          ),
        );
      }

      const markdownUrl = new AttachmentLinkBuilder(api)
        .asMarkdown()
        .setWidth(720)
        .getLink(metadata.key);
      onUploaded(markdownUrl);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload directory image</DialogTitle>
      <DialogContent>
        <AnimatePresence>
          {dragging && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(25,118,210,0.08)",
                border: "2px dashed",
                borderColor: "primary.main",
                borderRadius: 12,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}
        </AnimatePresence>

        <motion.div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!dragging) setDragging(true);
          }}
          onDragLeave={(event) => {
            // Only clear when the cursor actually leaves the drop zone,
            // not when it crosses over a nested element.
            if (
              event.currentTarget instanceof Element &&
              !event.currentTarget.contains(event.relatedTarget as Node)
            ) {
              setDragging(false);
            }
          }}
          onDrop={handleDrop}
          whileHover={{ scale: 1.01 }}
          animate={{
            scale: dragging ? 1.03 : 1,
            borderColor: dragging ? "#1976d2" : undefined,
          }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          style={{
            position: "relative",
            marginTop: 8,
            padding: "32px 16px",
            border: "2px dashed",
            borderColor: dragging ? "#1976d2" : "rgba(0,0,0,0.23)",
            borderRadius: 12,
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: dragging ? "rgba(25,118,210,0.04)" : "transparent",
          }}
        >
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                {previewUrl && (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt={selectedFile.name}
                    sx={{
                      maxWidth: "100%",
                      maxHeight: 240,
                      borderRadius: 1,
                      objectFit: "contain",
                    }}
                  />
                )}
                <Typography sx={{ mt: 1 }}>{selectedFile.name}</Typography>
              </motion.div>
            ) : initialPreview ? (
              <motion.div
                key="current"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Box
                  component="img"
                  src={initialPreview}
                  alt="current directory image"
                  sx={{
                    maxWidth: "100%",
                    maxHeight: 240,
                    borderRadius: 1,
                    objectFit: "contain",
                  }}
                />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ mt: 1 }}
                >
                  Current image. Drop a new one to replace it.
                </Typography>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <CloudUploadIcon
                  sx={{ fontSize: 48, color: "text.secondary" }}
                />
                <Typography variant="h6" sx={{ mt: 1 }}>
                  Drop an image here
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  or click to browse (png, jpeg, webp, gif)
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
        </motion.div>

        {readmePreview.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="textSecondary">
                Will be linked to the README.md note
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {readmePreview}
              </Typography>
            </Stack>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!selectedFile || uploading}
          onClick={() => void handleUpload()}
        >
          {deferUpload ? "Select" : "Upload"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageUploadModal;
