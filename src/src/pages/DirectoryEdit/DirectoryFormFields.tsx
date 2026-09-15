import { useState } from "react";
import {
  Box,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { DirectoryReply } from "../../api/models/directory";
import type { ShelfReply } from "../../api/models/shelf";
import { DirectoryParentChipSelect } from "../../components/DirectoryEdit/DirectoryParentChipSelect";
import { DirectoryShelfChipSelect } from "../../components/DirectoryEdit/DirectoryShelfChipSelect";
import { ImageUploadModal } from "../../components/DirectoryEdit/ImageUploadModal";
import { serializeReadme } from "../../utils/readme";

export interface DirectoryFormFieldsProps {
  /** Section title shown above the fields. `undefined` hides the heading block. */
  title?: string | undefined;
  /** Short helper line under the title. `undefined` (or empty) hides it. */
  subtitle?: string | undefined;

  name: string;
  description: string;
  imageUrl: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;

  hasPendingImage: boolean;
  imagePreviewUrl: string | null;
  onPendingImageFile: (file: File | null) => void;

  sortedDirectories: DirectoryReply[];
  parentIds: string[];
  onParentChange: (ids: string[]) => void;
  parentIsValid: boolean;

  /** Shelves surfaced in the shelf chip picker. */
  shelves: ShelfReply[];
  shelfIds: string[];
  onShelfChange: (ids: string[]) => void;

  /** When true, the directory image field is editable (Edit mode). */
  showImageUrlField?: boolean;
  /**
   * Edit-only: README state for the image upload modal to call back
   * into. Create mode hides the field entirely.
   */
  readmeBody?: string;
  getReadmeNoteId?: () => Promise<string | null>;
}

/**
 * The shared directory form body: name, description, image, parent,
 * shelves.
 *
 * Used by the standalone Create / Edit pages and by the
 * CreateDirectoryModal. Centralising the fields here keeps the two
 * surfaces from drifting in their inputs, validation, and layout.
 */
export const DirectoryFormFields: React.FC<DirectoryFormFieldsProps> = ({
  title,
  subtitle,
  name,
  description,
  imageUrl,
  onNameChange,
  onDescriptionChange,
  onImageUrlChange,
  hasPendingImage,
  imagePreviewUrl,
  onPendingImageFile,
  sortedDirectories,
  parentIds,
  onParentChange,
  parentIsValid,
  shelves,
  shelfIds,
  onShelfChange,
  showImageUrlField = false,
  readmeBody = "",
  getReadmeNoteId,
}) => {
  const [imageModalOpen, setImageModalOpen] = useState(false);

  return (
    <Stack spacing={2}>
      {(title || subtitle) && (
        <Stack spacing={0.5}>
          {title && (
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
        </Stack>
      )}

      <TextField
        label="Name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        autoFocus
        fullWidth
      />
      <TextField
        label="Description"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        multiline
        minRows={3}
        fullWidth
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        {showImageUrlField ? (
          <TextField
            label="Directory image"
            value={imageUrl}
            onChange={(event) => onImageUrlChange(event.target.value)}
            placeholder="https://..."
            fullWidth
          />
        ) : (
          <TextField
            label="Directory image"
            value={
              hasPendingImage ? "Image selected (preview on the right)" : ""
            }
            placeholder="No image selected"
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
        )}
        {imagePreviewUrl && (
          <Box
            component="img"
            src={imagePreviewUrl}
            alt="selected directory image preview"
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1,
              objectFit: "cover",
              mt: 0.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          />
        )}
        <Tooltip
          title={
            showImageUrlField
              ? "Upload an image. WerSu writes the URL into the README header."
              : "Upload an image. WerSu uploads it, links it to the new directory's README, and writes the URL into the directory on save."
          }
        >
          <span>
            <IconButton
              color="primary"
              onClick={() => setImageModalOpen(true)}
              sx={{ mt: 0.5 }}
              aria-label="upload directory image"
            >
              <EditIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <DirectoryParentChipSelect
        directories={sortedDirectories}
        value={parentIds}
        onChange={onParentChange}
        isValid={parentIsValid}
      />
      <DirectoryShelfChipSelect
        shelves={shelves}
        value={shelfIds}
        onChange={onShelfChange}
      />
      {showImageUrlField ? (
        <ImageUploadModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          onUploaded={(markdownUrl) =>
            onImageUrlChange(extractImageUrl(markdownUrl))
          }
          getReadmeNoteId={getReadmeNoteId ?? (async () => null)}
          currentImageUrl={imageUrl}
          readmeContent={serializeReadme(
            {
              name: name.trim() || "Untitled",
              description,
              imageUrl,
            },
            readmeBody,
          )}
        />
      ) : (
        <ImageUploadModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          deferUpload
          onFilePicked={(file) => onPendingImageFile(file)}
          getReadmeNoteId={async () => null}
        />
      )}
    </Stack>
  );
};

/**
 * `AttachmentLinkBuilder.asMarkdown()` returns `![...](url)`. The form
 * stores the URL itself (no markdown wrapper) so it round-trips
 * through `DirectoryReply.image_url`.
 */
const extractImageUrl = (markdownUrl: string): string => {
  const match = markdownUrl.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return match ? match[1] : markdownUrl;
};
