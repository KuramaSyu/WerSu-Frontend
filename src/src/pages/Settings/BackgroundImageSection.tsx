import {
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { bgLog, bgLogError } from "../../utils/bgDebug";
import { downscaleImageTo1080p } from "../../utils/imageDownscale";
import { useImageBlobCacheStore } from "../../zustand/useImageBlobCache";
import { useSelectedBackgroundImageStore } from "../../zustand/useSelectedBackgroundImageStore";
import {
  useBackgroundImageLibraryStore,
  type BackgroundImageEntry,
} from "../../zustand/useBackgroundImageLibraryStore";
import ModalShell from "../../components/ModalShell";

/**
 * Renders a single card for a stored background image: a small
 * preview tile, the display name (editable), the source URL, and
 * a pair of buttons (select, delete). The currently-active
 * background gets a check badge so the user can see which one
 * is in use.
 */
interface EntryCardProps {
  entry: BackgroundImageEntry;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  isActive,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.name);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Resolve src through the blob cache so the tile and AppBackground share the same image source.
  const cachedObjectUrl = useImageBlobCacheStore(
    (s) => s.byUrl.get(entry.src)?.objectUrl ?? null,
  );

  useEffect(() => {
    setDraft(entry.name);
  }, [entry.name]);

  const commitName = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== entry.name) {
      onRename(trimmed);
    } else {
      setDraft(entry.name);
    }
    setEditing(false);
  };

  const openPreview = (e: React.MouseEvent) => {
    // Image click is a separate gesture from "set as active"; never
    // let it bubble into the surrounding CardActionArea.
    e.stopPropagation();
    setPreviewOpen(true);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "stretch",
        borderColor: isActive ? "primary.main" : "divider",
        borderWidth: isActive ? 2 : 1,
      }}
    >
      <CardActionArea
        onClick={onSelect}
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: 1.5,
        }}
        aria-label={`Select background ${entry.name}`}
        data-testid={`background-entry-${entry.id}`}
      >
        <Box
          onClick={openPreview}
          role="button"
          tabIndex={0}
          aria-label={`View background ${entry.name} full size`}
          data-testid={`background-preview-${entry.id}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setPreviewOpen(true);
            }
          }}
          sx={{
            width: 96,
            height: 64,
            flexShrink: 0,
            borderRadius: 1,
            // Only render the backgroundImage when we actually have a
            // loadable URL. `entry.src` is often a `local:bg-...` key
            // that the browser can't resolve, which would render as a
            // gray box. A neutral placeholder icon is friendlier.
            ...(cachedObjectUrl !== null
              ? {
                  backgroundImage: `url(${cachedObjectUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  cursor: "zoom-in",
                }
              : {
                  display: "grid",
                  placeItems: "center",
                }),
            backgroundColor: "action.hover",
          }}
        >
          {cachedObjectUrl === null ? (
            <ImageIcon fontSize="small" color="disabled" />
          ) : null}
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
          {editing ? (
            <TextField
              autoFocus
              size="small"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                } else if (e.key === "Escape") {
                  setDraft(entry.name);
                  setEditing(false);
                }
              }}
              slotProps={{ htmlInput: { "aria-label": "Rename background" } }}
            />
          ) : (
            <Typography
              variant="subtitle1"
              noWrap
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              {entry.name}
            </Typography>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.src}
          </Typography>
        </Stack>
        {isActive ? (
          <CheckCircleIcon color="primary" aria-label="active background" />
        ) : null}
      </CardActionArea>
      <Stack direction="row" sx={{ alignItems: "center", pr: 1 }}>
        <Tooltip title="View full size">
          <IconButton
            aria-label={`View background ${entry.name}`}
            onClick={openPreview}
          >
            <VisibilityIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            aria-label={`Delete background ${entry.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        icon={<ImageIcon />}
        title={entry.name}
        subtitle={entry.src}
        maxWidth="lg"
        ariaLabelledBy={`background-preview-title-${entry.id}`}
      >
        {cachedObjectUrl !== null ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={cachedObjectUrl}
              alt={entry.name}
              data-testid={`background-preview-image-${entry.id}`}
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Preview unavailable. The cached image has not finished loading yet.
          </Typography>
        )}
      </ModalShell>
    </Card>
  );
};

/**
 * Settings panel for the user's background-image library.
 *
 *   - File picker that downscales the picked image to 1080p
 *     (long edge 1920) before stashing the bytes in IndexedDB.
 *   - List of every stored entry, each with a preview tile, an
 *     editable name, the source URL, a select button, and a
 *     delete button.
 *   - "Active" badge on the entry the user currently has set as
 *     the background.
 */
export const BackgroundImageSection: React.FC = () => {
  const { setMessage } = useInfoStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entries = useBackgroundImageLibraryStore((s) => s.entries);
  const addEntry = useBackgroundImageLibraryStore((s) => s.addEntry);
  const removeEntry = useBackgroundImageLibraryStore((s) => s.removeEntry);
  const renameEntry = useBackgroundImageLibraryStore((s) => s.renameEntry);
  const removeBlob = useBackgroundImageLibraryStore((s) => s.removeBlob);
  const userImage = useSelectedBackgroundImageStore((s) => s.userImage);
  const setUserImage = useSelectedBackgroundImageStore((s) => s.setUserImage);
  const [adding, setAdding] = useState(false);

  // Stable id; the suffix keeps two imports in the same ms from colliding.
  const generateId = (): string => {
    const random = Math.floor(Math.random() * 1_000_000).toString(36);
    return `bg-${Date.now().toString(36)}-${random}`;
  };

  const handleFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice fires change.
    event.target.value = "";
    bgLog(
      `handleFilePicked start file=${String(file?.name)} size=${String(file?.size)}`,
    );
    if (file === undefined) {
      bgLog("no file selected, bailing");
      return;
    }
    if (!file.type.startsWith("image/")) {
      bgLog(`not an image file, type=${file.type}`);
      setMessage(
        new SnackbarUpdateImpl("Please pick an image file", "warning"),
      );
      return;
    }
    setAdding(true);
    bgLog(`setAdding(true) at ${String(Date.now())}`);
    try {
      const t0 = Date.now();
      bgLog(`starting downscale at ${String(t0)}`);
      const { blob, contentType } = await downscaleImageTo1080p(file);
      bgLog(
        `downscale done in ${String(Date.now() - t0)} ms, blob=${String(blob.size)} bytes, type=${contentType}`,
      );
      // Use a local: URL as the src; the blob cache stores the bytes
      // under that key and the selected store will resolve it to a
      // blob: URL on render.
      const id = generateId();
      const src = `local:${id}`;
      bgLog(`putting into blob cache src=${src}`);
      const t1 = Date.now();
      await useImageBlobCacheStore.getState().put(src, blob);
      bgLog(`blob cache put done in ${String(Date.now() - t1)} ms`);
      bgLog(`calling addEntry id=${src}`);
      addEntry({
        id,
        name: file.name.replace(/\.[^./]+$/u, "") || "Background",
        src,
      });
      bgLog(`calling setUserImage ${src}`);
      setUserImage(src);
      bgLog("setUserImage returned");
      setMessage(new SnackbarUpdateImpl("Background image added", "success"));
      bgLog(`handleFilePicked success at ${String(Date.now() - t0)} ms`);
    } catch (err) {
      bgLogError(`handleFilePicked threw: ${String(err)}`);
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error
            ? `Failed to add background: ${err.message}`
            : "Failed to add background",
          "error",
        ),
      );
    } finally {
      bgLog(`finally -> setAdding(false) at ${String(Date.now())}`);
      setAdding(false);
      bgLog(`handleFilePicked end at ${String(Date.now())}`);
    }
  };

  // Library entry removal also drops the cached blob bytes.
  const handleDelete = (entry: BackgroundImageEntry) => {
    removeBlob(entry.src);
    if (userImage === entry.src) {
      setUserImage(null);
    }
    removeEntry(entry.id);
  };

  const handlePick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Stack direction="column" spacing={3}>
      <Stack>
        <Typography variant="subtitle1">Custom background</Typography>
        <Typography variant="body2" color="text.secondary">
          Add images to use as the app background. Picked images are downscaled
          to 1080p and cached locally; the library persists for the browser
          session.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Button
          variant="outlined"
          startIcon={adding ? <CircularProgress size={16} /> : <AddPhotoIcon />}
          onClick={handlePick}
          disabled={adding}
        >
          {adding ? "Adding..." : "Add image"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFilePicked}
          data-testid="background-file-input"
        />
        {userImage === null ? (
          <Typography variant="body2" color="text.secondary">
            No background active.
          </Typography>
        ) : null}
      </Stack>

      <Divider />

      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No images yet. Add one to use a custom background.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isActive={userImage === entry.src}
              onSelect={() => setUserImage(entry.src)}
              onDelete={() => handleDelete(entry)}
              onRename={(name) => renameEntry(entry.id, name)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default BackgroundImageSection;
