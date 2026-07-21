import { useRef, useState } from "react";
import type { IconButtonProps } from "@mui/material";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  Typography,
  styled,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

/** True for files whose MIME type or extension looks like a zip. */
function isZipFile(file: File): boolean {
  if (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  ) {
    return true;
  }
  return file.name.toLowerCase().endsWith(".zip");
}

/** Per-file upload state, indexed parallel to `files`. */
type ImportStatus =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; reply: BookstackBookImportReply }
  | { kind: "error"; message: string };

/** Stable key for a `File` so React can reconcile across re-renders. */
function fileKey(file: File, index: number): string {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

interface FileChipProps {
  file: File;
  status: ImportStatus;
  /** Remove button is hidden while an upload is running. */
  disabled: boolean;
  onRemove: () => void;
}

/**
 * Always-visible details line shown in the card body (below the
 * header, above the actions). Every state surfaces something useful
 * so a collapsed card never reads as empty:
 * idle -> "Ready to import" hint, uploading -> spinner + label,
 * success -> totals, error -> the error
 * message.
 */
function ChipHeaderStatus({ status }: { status: ImportStatus }) {
  switch (status.kind) {
    case "idle":
      return (
        <Typography variant="caption" color="text.secondary">
          Ready to import
        </Typography>
      );
    case "uploading":
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <CircularProgress size={10} />
          <Typography variant="caption">Importing...</Typography>
        </Stack>
      );
    case "success": {
      const reply = status.reply;
      return (
        <Stack spacing={0.25}>
          <Typography variant="caption" color="success.main">
            {reply.pages_imported} page(s), {reply.attachments_uploaded}{" "}
            attachment(s), {reply.chapters.length} chapter(s)
          </Typography>
        </Stack>
      );
    }
    case "error":
      return (
        <Typography variant="caption" color="error.main" noWrap>
          {status.message}
        </Typography>
      );
  }
}

/**
 * Full-detail body shown when the accordion is expanded.
 *
 * idle / uploading -> short placeholder so the panel isn't empty;
 * success -> the per-chapter breakdown (the "before" detail list) plus
 * the new directory id; error -> the full error message.
 */
function ChipDetails({ status }: { status: ImportStatus }) {
  if (status.kind === "success") {
    const reply = status.reply;
    // The totals + directory id are already in the always-visible
    // summary above; the expanded body just drills into per-chapter
    // detail.
    return reply.chapters.length > 0 ? (
      <Box component="ul" sx={{ m: 0, pl: 2.5, textAlign: "left" }}>
        {reply.chapters.map((chapter) => (
          <li key={chapter.directory_id}>
            <Typography variant="caption">
              {chapter.chapter_name}: {chapter.pages_imported} page(s)
            </Typography>
          </li>
        ))}
      </Box>
    ) : (
      <Typography variant="caption" color="text.secondary">
        Book had no chapters.
      </Typography>
    );
  }
  if (status.kind === "error") {
    return (
      <Typography variant="caption" color="error.main">
        {status.message}
      </Typography>
    );
  }
  if (status.kind === "uploading") {
    return (
      <Typography variant="caption" color="text.secondary">
        Import in progress...
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color="text.secondary">
      Details will appear after import.
    </Typography>
  );
}

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

/**
 * Expand/collapse icon button that mirrors the MUI recipe-card
 * example: chevron rotates 180° when the card is expanded.
 */
const ExpandMore = styled((props: ExpandMoreProps) => {
  // Strip our custom `expand` flag before forwarding so it doesn't
  // leak onto the DOM; the styled wrapper below reads it.
  const { expand, ...other } = props;
  // `aria-expanded` is what assistive tech reads for the toggle.
  return <IconButton {...other} aria-expanded={expand} />;
})(({ theme }) => ({
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
  // MUI v6+ `variants` API: rotate the chevron based on `expand`.
  variants: [
    {
      props: ({ expand }: { expand: boolean }) => !expand,
      style: { transform: "rotate(0deg)" },
    },
    {
      props: ({ expand }: { expand: boolean }) => !!expand,
      style: { transform: "rotate(180deg)" },
    },
  ],
}));

/**
 * MUI Card-style chip for one selected zip, modelled on the
 * `RecipeReviewCard` example:
 *
 *   - `CardHeader` shows the file icon as the avatar, the filename
 *     as the title, and the formatted byte size as the subheader.
 *   - The top-right corner hosts the Close `IconButton` as the
 *     header's `action` (only while idle, like the example's
 *     three-dot menu) so users get a single obvious affordance to
 *     drop a file before importing.
 *   - `CardContent` carries the one-line status summary.
 *   - `CardActions` hosts the expand/collapse chevron (right-aligned
 *     via `marginLeft: auto`).
 *   - `Collapse` reveals the full per-chapter breakdown (success) or
 *     the full error message (failure) on demand.
 *
 * Sits in a `flexWrap` grid in `BookstackImportSection`; chips share
 * each row equally (up to ~3 per row) and wrap to a new row as more
 * are added.
 */
const FileChip: React.FC<FileChipProps> = ({
  file,
  status,
  disabled,
  onRemove,
}) => {
  const [expanded, setExpanded] = useState(false);
  const handleExpandClick = () => {
    setExpanded((prev) => !prev);
  };
  // Avatar colour follows status so failures/successes stand out
  // even when the card is collapsed.
  const avatarBg =
    status.kind === "error"
      ? "error.main"
      : status.kind === "success"
        ? "success.main"
        : "primary.main";
  const showRemove = status.kind === "idle" && !disabled;
  return (
    <Card
      sx={{
        // Share each row equally with up to ~3 siblings (basis 15rem),
        // grow to fill a row when alone, shrink to fit when crowded.
        flex: "1 1 15rem",
        // Don't stretch siblings to match this card's expanded height.
        alignSelf: "flex-start",
        // Slight tint per status so the user can spot failures at a
        // glance without expanding every card.
        borderColor:
          status.kind === "error"
            ? "error.main"
            : status.kind === "success"
              ? "success.main"
              : "divider",
      }}
      variant="outlined"
    >
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: avatarBg }} aria-label="file">
            <UploadFileIcon fontSize="small" />
          </Avatar>
        }
        action={
          showRemove ? (
            <IconButton aria-label={`remove ${file.name}`} onClick={onRemove}>
              <CloseIcon />
            </IconButton>
          ) : null
        }
        title={file.name}
        subheader={formatBytes(file.size)}
        titleTypographyProps={{
          variant: "body2",
          noWrap: true,
          title: file.name,
        }}
        subheaderTypographyProps={{ variant: "caption" }}
      />
      <CardContent
        sx={{ pt: 0, pb: 1, "&:last-child": { pb: 1 } }}
      ></CardContent>
      <CardActions disableSpacing>
        {/* spacing box */}
        {/* <Box sx={{ width: 1 / 3 }}></Box> */}
        <ChipHeaderStatus status={status} />
        <ExpandMore
          expand={expanded}
          onClick={handleExpandClick}
          aria-expanded={expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </ExpandMore>
      </CardActions>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent
          sx={{
            // Cap the body so an enormous chapter list scrolls inside
            // the card instead of pushing the row very tall.
            maxHeight: "13.75rem",
            overflowY: "auto",
          }}
        >
          <ChipDetails status={status} />
        </CardContent>
      </Collapse>
    </Card>
  );
};

/**
 * Body of the "BookStack import" category on the Settings page.
 *
 * Lets the user drop or browse for one or more BookStack book zips,
 * uploads them in parallel via `POST /api/migrations/import_bookstack_book`
 * and shows the per-file reply (book directory id, per-chapter counts,
 * totals) inline on each chip. Errors from the backend are surfaced on
 * the chip and echoed via the snackbar.
 */
export const BookstackImportSection: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [statuses, setStatuses] = useState<ImportStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const { setMessage } = useInfoStore();

  /** Apply a freshly-picked set: keep only zips and reset each status. */
  const selectFiles = (next: File[]) => {
    const zips = next.filter(isZipFile);
    setFiles(zips);
    setStatuses(zips.map(() => ({ kind: "idle" })));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setStatuses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    // Accept every dropped file; non-zips are filtered out below.
    const dropped = e.dataTransfer.files
      ? Array.from(e.dataTransfer.files)
      : [];
    if (dropped.length > 0) {
      selectFiles(dropped);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    const picked = e.target.files ? Array.from(e.target.files) : [];
    selectFiles(picked);
    // Reset the input so the same filenames can be re-picked after rejection.
    e.target.value = "";
  };

  const handleImportAll = async () => {
    if (files.length === 0 || uploading) {
      return;
    }
    setUploading(true);
    setStatuses(files.map(() => ({ kind: "uploading" })));

    // Fire every import in parallel; allSettled so one rejection
    // doesn't short-circuit the others.
    const results = await Promise.allSettled(
      files.map((f) => getBookstackImportApi().importBook(f)),
    );

    const nextStatuses: ImportStatus[] = results.map((r) => {
      if (r.status === "fulfilled") {
        return { kind: "success", reply: r.value };
      }
      const message =
        r.reason instanceof Error ? r.reason.message : "Unknown import failure";
      return { kind: "error", message };
    });
    setStatuses(nextStatuses);

    // Import adds new dirs/notes/attachments -> nuke every cache except user
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== "user" && q.queryKey[0] !== "users",
    });

    const successes = nextStatuses.filter((s) => s.kind === "success").length;
    const failures = nextStatuses.length - successes;
    if (failures === 0) {
      setMessage(
        new SnackbarUpdateImpl(
          `Imported ${successes} book${successes === 1 ? "" : "s"}`,
          "success",
        ),
      );
    } else {
      setMessage(
        new SnackbarUpdateImpl(
          `Imported ${successes} book(s), ${failures} failed`,
          "error",
        ),
      );
    }

    setUploading(false);
  };

  return (
    <Stack direction="column" spacing={2}>
      <Typography variant="body1">
        Drop one or more BookStack book zips here to import them as separate
        directory trees. Files are uploaded in parallel and streamed to the
        backend in 1 MiB chunks; large books may take a moment.
      </Typography>

      <Box
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging && !uploading) {
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
          cursor: uploading ? "default" : "pointer",
          backgroundColor: dragging ? "action.hover" : "transparent",
          opacity: uploading ? 0.5 : 1,
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
            {files.length > 0 ? "Replace files" : "Drag zip(s) here"}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            or click to browse
          </Typography>
        </Stack>
        <input
          ref={fileInputRef}
          hidden
          multiple
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </Box>

      {files.length > 0 && (
        // Flex-wrap grid: chips share each row equally (basis 15rem
        // with `flex: 1`) and wrap to additional rows when there are
        // more than ~3. No horizontal scrollbar: the layout fills the
        // available width like a normal CSS grid.
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {files.map((file, i) => (
            <FileChip
              key={fileKey(file, i)}
              file={file}
              status={statuses[i] ?? { kind: "idle" }}
              disabled={uploading}
              onRemove={() => removeFile(i)}
            />
          ))}
        </Box>
      )}

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
          disabled={files.length === 0 || uploading}
          onClick={() => void handleImportAll()}
        >
          {(() => {
            // "Finished" = no longer in flight (success or error).
            // Surfaced in the button so the user can see batch
            // progress at a glance.
            const finishedCount = statuses.filter(
              (s) => s.kind === "success" || s.kind === "error",
            ).length;
            if (uploading) {
              return `Importing ${files.length} (${finishedCount}/${files.length} done)`;
            }
            if (finishedCount > 0) {
              return `Import ${files.length} file${files.length === 1 ? "" : "s"} (${finishedCount} done)`;
            }
            return `Import ${files.length} file${files.length === 1 ? "" : "s"}`;
          })()}
        </Button>
        {files.length > 0 && !uploading && (
          <Button color="inherit" onClick={() => selectFiles([])}>
            Clear
          </Button>
        )}
      </Stack>
    </Stack>
  );
};
