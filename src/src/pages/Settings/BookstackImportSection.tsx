import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  getBookstackImportApi,
  type BookstackBookImportReply,
} from "../../api/BookstackImportApi";
import { queryClient } from "../../api/queryClient";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

/**
 * Pretty byte-size formatter for the selected-file label.
 *
 * Falls back to the raw byte count for unknown units so we never
 * surface `NaN` for zero-byte files.
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return `${bytes} B`;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Body of the "BookStack import" category on the Settings page.
 *
 * Lets the user drop or browse for a BookStack book zip, uploads it
 * via `POST /api/migrations/import_bookstack_book` and surfaces the
 * reply (book directory id, per-chapter counts, totals) in a result
 * panel. Errors from the backend are shown inline and echoed via the
 * snackbar so the user always knows what happened.
 */
export const BookstackImportSection: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookstackBookImportReply | null>(null);
  const { setMessage } = useInfoStore();

  /** Apply a newly-selected file: stash it and clear any stale error/result. */
  const selectFile = (next: File | null) => {
    setFile(next);
    setError(null);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    // Only accept the first file in the drop; BookStack exports are
    // a single archive per book, so multiple files would be a UX bug.
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) {
      selectFile(dropped);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    selectFile(picked);
    // Reset the input so the same filename can be re-picked after rejection.
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!file || uploading) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const reply = await getBookstackImportApi().importBook(file);
      setResult(reply);
      // Import adds new dirs/notes/attachments -> nuke every cache except user
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "user" && q.queryKey[0] !== "users",
      });
      setMessage(
        new SnackbarUpdateImpl(
          `Imported ${reply.pages_imported} page(s) from ${file.name}`,
          "success",
        ),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown import failure";
      setError(message);
      setMessage(new SnackbarUpdateImpl(message, "error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack direction="column" spacing={2}>
      <Typography variant="body1">
        Drop a BookStack book zip here to import it as a new directory tree. The
        file is streamed to the backend in 1 MiB chunks; large books may take a
        moment.
      </Typography>

      <Box
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) {
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          // Only clear when the cursor actually leaves the drop zone,
          // not when it crosses over a nested element.
          if (
            e.currentTarget instanceof Element &&
            !e.currentTarget.contains(e.relatedTarget as Node)
          ) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
        sx={{
          p: 4,
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 2,
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: dragging ? "action.hover" : "transparent",
          transition: "all .2s",
        }}
      >
        <Stack
          direction="column"
          spacing={1}
          sx={{ alignItems: "center", pointerEvents: "none" }}
        >
          <CloudUploadIcon
            fontSize="large"
            color={dragging ? "primary" : "inherit"}
          />
          <Typography variant="h6">
            {file ? "Replace file" : "Drag a zip here"}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            or click to browse
          </Typography>
          {file && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <UploadFileIcon fontSize="small" />
              <Typography variant="body2">
                {file.name} ({formatBytes(file.size)})
              </Typography>
            </Stack>
          )}
        </Stack>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileChange}
        />
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Button
          variant="contained"
          startIcon={
            uploading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <CloudUploadIcon />
            )
          }
          disabled={!file || uploading}
          onClick={() => void handleUpload()}
        >
          {uploading ? "Importing..." : "Import"}
        </Button>
        {file && !uploading && (
          <Button color="inherit" onClick={() => selectFile(null)}>
            Clear
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {result && (
        <Alert severity="success">
          <Typography variant="subtitle2">
            Imported book into directory {result.book_directory_id}
          </Typography>
          <Typography variant="body2">
            {result.pages_imported} page(s), {result.attachments_uploaded}{" "}
            attachment(s), {result.chapters.length} chapter(s).
          </Typography>
          {result.chapters.length > 0 && (
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 3, textAlign: "left" }}>
              {result.chapters.map((chapter) => (
                <li key={chapter.directory_id}>
                  <Typography variant="body2">
                    {chapter.chapter_name}: {chapter.pages_imported} page(s)
                  </Typography>
                </li>
              ))}
            </Box>
          )}
        </Alert>
      )}
    </Stack>
  );
};
