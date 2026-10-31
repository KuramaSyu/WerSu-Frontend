import {
  Box,
  Button,
  CircularProgress,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import { useState, type ChangeEvent } from "react";
import { ModalShell } from "./ModalShell";
import { useThemeStore } from "../zustand/useThemeStore";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import useInfoStore, { SnackbarUpdateImpl } from "../zustand/InfoStore";
import { blurImageToWebp, fetchImageBlob } from "../utils/imageBlur";
import {
  DEFAULT_THEME_BLUR,
  MAX_THEME_NAME_LENGTH,
  type GeneratedThemeRecord,
  type ImageThemePalette,
} from "../theme/imageTheme";

/** Editable palette tokens and their display labels, in modal order. */
const PALETTE_FIELD_LABELS: readonly {
  key: keyof ImageThemePalette;
  label: string;
}[] = [
  { key: "primary", label: "Primary" },
  { key: "primaryLight", label: "Primary light" },
  { key: "primaryDark", label: "Primary dark" },
  { key: "secondary", label: "Secondary" },
  { key: "secondaryLight", label: "Secondary light" },
  { key: "secondaryDark", label: "Secondary dark" },
  { key: "backgroundDefault", label: "Background" },
  { key: "backgroundPaper", label: "Paper" },
  { key: "panel", label: "Panel" },
  { key: "textPrimary", label: "Text" },
  { key: "textSecondary", label: "Text secondary" },
  { key: "muted", label: "Muted" },
  { key: "mutedLight", label: "Muted light" },
  { key: "mutedDark", label: "Muted dark" },
  { key: "vibrant", label: "Vibrant" },
];

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Native color swatch + hex readout for one palette token. */
const ColorField: React.FC<ColorFieldProps> = ({ label, value, onChange }) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
    <Box
      component="input"
      type="color"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      aria-label={`${label} color`}
      data-testid={`theme-color-input-${label}`}
      sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        p: 0,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        cursor: "pointer",
        backgroundColor: "transparent",
      }}
    />
    <Stack sx={{ minWidth: 0 }}>
      <Typography variant="body2">{label}</Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontFamily: "monospace" }}
      >
        {value.toUpperCase()}
      </Typography>
    </Stack>
  </Stack>
);

export interface ThemeEditModalProps {
  /** Theme being edited; `null` closes the dialog. */
  record: GeneratedThemeRecord | null;
  open: boolean;
  onClose: () => void;
}

/**
 * In-place editor for a generated theme: rename it, retune any of its
 * palette tokens, and adjust the background blur. Self-contained — it
 * writes through to the theme store via `updateGeneratedTheme`, so
 * every call site (Settings and the avatar theme picker) shares the
 * exact same behaviour.
 *
 * Changing the blur regenerates the pre-rendered blurred variant from
 * the non-blurred source and stores it in IndexedDB.
 *
 * Remount per record (`key`) so the draft always starts from the theme
 * being edited.
 */
export const ThemeEditModal: React.FC<ThemeEditModalProps> = ({
  record,
  open,
  onClose,
}) => {
  const { setMessage } = useInfoStore();
  const updateGeneratedTheme = useThemeStore((s) => s.updateGeneratedTheme);
  const [name, setName] = useState(record?.longName ?? "");
  const [palette, setPalette] = useState<ImageThemePalette | null>(
    record?.palette ?? null,
  );
  const [blur, setBlur] = useState(record?.blur ?? DEFAULT_THEME_BLUR);
  const [saving, setSaving] = useState(false);

  // Non-blurred source for the live preview. `local:` images resolve
  // through the blob cache; URLs render directly.
  const sourceKey = record?.backgroundImage ?? "";
  const cachedSourceUrl = useImageBlobCacheStore(
    (s) => s.byUrl.get(sourceKey)?.objectUrl ?? null,
  );
  const sourceUrl = sourceKey.startsWith("local:")
    ? cachedSourceUrl
    : sourceKey.length > 0
      ? sourceKey
      : null;
  // Scale the full-size blur radius down to the preview box so the
  // slider gives a readable sense of the effect.
  const previewBlurPx = (blur / 100) * 13;

  const setColor = (key: keyof ImageThemePalette, value: string) => {
    setPalette((prev) => (prev === null ? prev : { ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (record === null || palette === null || name.trim().length === 0) {
      return;
    }
    setSaving(true);
    try {
      const cache = useImageBlobCacheStore.getState();
      let blurredBackgroundImage = record.blurredBackgroundImage;

      if (blur === 0) {
        // No blur: drop the pre-rendered variant and fall back to the
        // original source.
        if (blurredBackgroundImage.startsWith("local:")) {
          await cache.remove(blurredBackgroundImage);
        }
        blurredBackgroundImage = "";
      } else if (
        blur !== record.blur ||
        blurredBackgroundImage.length === 0
      ) {
        // Regenerate from the non-blurred source.
        let sourceBlob: Blob | undefined;
        if (record.backgroundImage.startsWith("local:")) {
          const entry = await cache.resolve(record.backgroundImage);
          sourceBlob = entry?.blob;
        } else if (record.backgroundImage.length > 0) {
          sourceBlob = await fetchImageBlob(record.backgroundImage);
        }
        if (sourceBlob === undefined) {
          throw new Error("the original image is no longer available");
        }

        const blurredBlob = await blurImageToWebp(sourceBlob, blur);
        const key = blurredBackgroundImage.startsWith("local:")
          ? blurredBackgroundImage
          : `local:theme-bg-${Date.now().toString(36)}-${Math.floor(
              Math.random() * 1_000_000,
            ).toString(36)}-blur`;
        await cache.put(key, blurredBlob);
        blurredBackgroundImage = key;
      }

      updateGeneratedTheme(record.id, {
        longName: name,
        palette,
        blur,
        blurredBackgroundImage,
      });
      setMessage(
        new SnackbarUpdateImpl(`Theme "${name.trim()}" updated`, "success"),
      );
      onClose();
    } catch (err) {
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error
            ? `Could not update theme: ${err.message}`
            : "Could not update theme",
          "error",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<EditIcon />}
      title="Edit theme"
      subtitle={record?.longName}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              saving || name.trim().length === 0 || palette === null
            }
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </>
      }
    >
      <Stack spacing={3}>
        <TextField
          label="Theme name"
          size="small"
          fullWidth
          value={name}
          onChange={(e) =>
            setName(e.target.value.slice(0, MAX_THEME_NAME_LENGTH))
          }
          slotProps={{
            htmlInput: {
              maxLength: MAX_THEME_NAME_LENGTH,
              "aria-label": "Edited theme name",
            },
          }}
        />

        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "baseline" }}
            >
              <Typography variant="body2">Background blur</Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(blur)}%
              </Typography>
            </Stack>
            <Slider
              value={blur}
              min={0}
              max={100}
              step={1}
              marks={[
                { value: 0, label: "0%" },
                { value: 33, label: "33%" },
                { value: 66, label: "66%" },
                { value: 100, label: "100%" },
              ]}
              onChange={(_, value) => setBlur(value as number)}
              valueLabelDisplay="auto"
              aria-label="Background blur"
              data-testid="theme-blur-slider"
            />
          </Stack>
          <Box
            data-testid="theme-blur-preview"
            sx={{
              width: 160,
              height: 112,
              flexShrink: 0,
              borderRadius: 1,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "action.hover",
            }}
          >
            {sourceUrl !== null ? (
              <Box
                component="img"
                src={sourceUrl}
                alt="Background blur preview"
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: `blur(${previewBlurPx}px)`,
                }}
              />
            ) : (
              <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
                <ImageIcon fontSize="small" color="disabled" />
              </Box>
            )}
          </Box>
        </Stack>

        {palette !== null ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            {PALETTE_FIELD_LABELS.map(({ key, label }) => (
              <ColorField
                key={key}
                label={label}
                value={palette[key]}
                onChange={(value) => setColor(key, value)}
              />
            ))}
          </Box>
        ) : null}
      </Stack>
    </ModalShell>
  );
};

export default ThemeEditModal;
