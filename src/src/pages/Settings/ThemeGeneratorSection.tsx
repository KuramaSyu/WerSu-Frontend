import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LightModeIcon from "@mui/icons-material/LightMode";
import LinkIcon from "@mui/icons-material/Link";
import SaveIcon from "@mui/icons-material/Save";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useImageBlobCacheStore } from "../../zustand/useImageBlobCache";
import { downscaleImageTo1080p } from "../../utils/imageDownscale";
import { blurImageToWebp, fetchImageBlob } from "../../utils/imageBlur";
import { useCachedImageUrl } from "../../hooks/useCachedImageUrl";
import { normalizeImageUrl } from "../../utils/imageUrl";
import {
  buildPaletteFromSwatches,
  DEFAULT_THEME_BLUR,
  extractImageSwatches,
  MAX_THEME_NAME_LENGTH,
  type GeneratedThemeRecord,
  type ImageSwatchData,
  type ThemeMode,
} from "../../theme/imageTheme";
import { ThemeColorCircles } from "../../components/ThemeColorCircles";
import { ThemeEditModal } from "../../components/ThemeEditModal";
import {
  useCustomThemesPreference,
  usePublishCustomThemes,
} from "../../hooks/useCustomThemes";
import type { CustomThemeScope } from "../../models/customThemes";
import type { ThemePreference } from "../../models/Preferences";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { useUserStore } from "../../zustand/userStore";
const stripExtension = (fileName: string): string =>
  fileName.replace(/\.[^./]+$/u, "").trim();

/** Derive a default theme name from the last path segment of a URL. */
const nameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").filter(Boolean).pop() ?? "";
    return stripExtension(decodeURIComponent(base)) || "Generated theme";
  } catch {
    return "Generated theme";
  }
};

interface GeneratedThemeRowProps {
  record: GeneratedThemeRecord;
  isActive: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const GeneratedThemeRow: React.FC<GeneratedThemeRowProps> = ({
  record,
  isActive,
  onApply,
  onEdit,
  onDelete,
}) => {
  // Backgrounds resolve through the IndexedDB blob cache; remote URLs are
  // downloaded and persisted on first render.
  const thumbnail = useCachedImageUrl(record.backgroundImage);
  return (
    <Card
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 1.5,
        borderColor: isActive ? "primary.main" : "divider",
        borderWidth: isActive ? 2 : 1,
      }}
      data-testid={`generated-theme-${record.id}`}
    >
      {thumbnail !== null ? (
        <Box
          data-testid={`generated-theme-thumbnail-${record.id}`}
          sx={{
            width: 64,
            height: 48,
            flexShrink: 0,
            borderRadius: 1,
            backgroundColor: "action.hover",
            backgroundImage: `url(${thumbnail})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}
      <ThemeColorCircles
        palette={{
          primary: record.palette.primary,
          secondary: record.palette.secondary,
          paper: record.palette.backgroundPaper,
          default: record.palette.backgroundDefault,
        }}
        circleSize={24}
        ariaLabel={`${record.longName} color preview`}
      />
      <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
        <Typography variant="subtitle1" noWrap>
          {record.longName}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            label={record.mode === "dark" ? "Dark" : "Light"}
            icon={
              record.mode === "dark" ? (
                <DarkModeIcon fontSize="small" />
              ) : (
                <LightModeIcon fontSize="small" />
              )
            }
          />
        </Stack>
      </Stack>
      {isActive ? (
        <CheckCircleIcon color="primary" aria-label="active theme" />
      ) : null}
      <Button size="small" variant="outlined" onClick={onApply}>
        Use
      </Button>
      <Tooltip title="Edit theme">
        <IconButton
          aria-label={`Edit theme ${record.longName}`}
          onClick={onEdit}
        >
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete theme">
        <IconButton
          aria-label={`Delete theme ${record.longName}`}
          onClick={onDelete}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Card>
  );
};

/**
 * Settings section that builds a theme from an image.
 *
 * Flow: pick a file (persisted to IndexedDB) or paste a URL -> Vibrant
 * extracts its palette -> the user can flip light/dark and name the
 * result -> saving registers it with the `ThemeManager` and applies it.
 * The source image is used as the theme's background. Saved themes then
 * appear in the normal theme picker (avatar menu) like any bundled
 * theme.
 */
export const ThemeGeneratorSection: React.FC = () => {
  const { setMessage } = useInfoStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generatedThemes = useThemeStore((s) => s.generatedThemes);
  const addGeneratedTheme = useThemeStore((s) => s.addGeneratedTheme);
  const removeGeneratedTheme = useThemeStore((s) => s.removeGeneratedTheme);
  const selectTheme = useThemeStore((s) => s.selectTheme);
  const themeName = useThemeStore((s) => s.themeName);
  const userId = useUserStore((s) => s.user?.id ?? null);
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  const { publish, isPublishing } = usePublishCustomThemes();
  // Where the newly saved theme should live: personal or shared with the
  // currently selected shelf.
  const [ownerScope, setOwnerScope] = useState<CustomThemeScope>("user");
  // Existing payloads are merged with the new pair so publishing from a
  // device that only has *synced* themes never drops them.
  const userThemes = useCustomThemesPreference({
    scope: "user",
    targetId: userId ?? "",
  });
  const shelfThemesData = useCustomThemesPreference({
    scope: "shelf",
    targetId: selectedShelfId ?? "",
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Set only for disk uploads; its bytes are written to IndexedDB on save.
  const [pendingBlob, setPendingBlob] = useState<File | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [swatches, setSwatches] = useState<ImageSwatchData | null>(null);
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [name, setName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<GeneratedThemeRecord | null>(null);

  // Revoke the object URL when it is replaced or the section unmounts.
  // Remote URLs are left untouched (revoking one is a no-op).
  useEffect(() => {
    return () => {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const palette = useMemo(
    () => (swatches === null ? null : buildPaletteFromSwatches(swatches, mode)),
    [swatches, mode],
  );

  const resetDraft = () => {
    setSwatches(null);
    setName("");
    setPreviewUrl(null);
    setPendingBlob(null);
    setUrlInput("");
    setUrlMode(false);
  };

  const handleFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice fires change.
    event.target.value = "";
    if (file === undefined) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage(
        new SnackbarUpdateImpl("Please pick an image file", "warning"),
      );
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPendingBlob(file);
    setPreviewUrl(objectUrl);
    setName(stripExtension(file.name) || "Generated theme");
    setAnalyzing(true);
    try {
      const extracted = await extractImageSwatches(objectUrl);
      setSwatches(extracted);
      setMode(extracted.suggestedMode);
    } catch (err) {
      setSwatches(null);
      setPreviewUrl(null);
      setPendingBlob(null);
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error
            ? `Could not read that image: ${err.message}`
            : "Could not read that image",
          "error",
        ),
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoadUrl = async () => {
    // Rewrite GitHub raw/blob page URLs to their direct asset form so
    // the CORS-required canvas read is not blocked by a redirect.
    const url = normalizeImageUrl(urlInput);
    if (url.length === 0) {
      setMessage(new SnackbarUpdateImpl("Enter an image URL", "warning"));
      return;
    }
    setPendingBlob(null);
    setPreviewUrl(url);
    setName(nameFromUrl(url));
    setAnalyzing(true);
    try {
      const extracted = await extractImageSwatches(url);
      setSwatches(extracted);
      setMode(extracted.suggestedMode);
    } catch (err) {
      setSwatches(null);
      setPreviewUrl(null);
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error
            ? `Could not load that image. The host may block cross-origin reads (CORS); download the image and use “Choose image”. (${err.message})`
            : "Could not load that image. The host may block cross-origin reads (CORS); download the image and use “Choose image”.",
          "error",
        ),
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    const longName = name.trim();
    if (longName.length === 0 || swatches === null || previewUrl === null) {
      return;
    }
    setSaving(true);
    try {
      const cache = useImageBlobCacheStore.getState();
      const makeKey = (suffix: string) =>
        `local:theme-bg-${Date.now().toString(36)}-${Math.floor(
          Math.random() * 1_000_000,
        ).toString(36)}${suffix}`;

      // Disk uploads are persisted to IndexedDB under a `local:` key so
      // the theme survives a reload; remote URLs are stored as-is (only
      // the blurred variant needs a local copy).
      let backgroundImage: string;
      let sourceBlob: Blob | null = null;
      if (pendingBlob !== null) {
        // Downscale before persisting so a full-resolution upload does not
        // bloat IndexedDB; 1080p is plenty for a full-screen background.
        const { blob } = await downscaleImageTo1080p(pendingBlob);
        backgroundImage = makeKey("");
        await cache.put(backgroundImage, blob);
        sourceBlob = blob;
      } else {
        backgroundImage = previewUrl;
        try {
          sourceBlob = await fetchImageBlob(previewUrl);
          // Cache the original URL blob so later renders are IndexedDB
          // hits instead of network fetches (and the theme works offline).
          await cache.put(backgroundImage, sourceBlob);
        } catch {
          // CORS/network blocked the read; keep the theme, just without
          // a pre-rendered blur.
          sourceBlob = null;
        }
      }

      // Store a second, pre-blurred copy of the image at the default
      // blur so the background renders without a runtime filter.
      let blurredBackgroundImage = "";
      if (sourceBlob !== null) {
        try {
          const blurred = await blurImageToWebp(sourceBlob, DEFAULT_THEME_BLUR);
          blurredBackgroundImage = makeKey("-blur");
          await cache.put(blurredBackgroundImage, blurred);
        } catch {
          blurredBackgroundImage = "";
        }
      }

      const shareToShelf = ownerScope === "shelf";
      if (shareToShelf && selectedShelfId === null) {
        setMessage(
          new SnackbarUpdateImpl(
            "Select a shelf before sharing a theme with one",
            "warning",
          ),
        );
        return;
      }
      const targetId = shareToShelf
        ? (selectedShelfId as string)
        : (userId as string);
      if (!shareToShelf && userId === null) {
        setMessage(
          new SnackbarUpdateImpl("Sign in to save a theme", "warning"),
        );
        return;
      }

      // One image yields a matched dark + light pair, so the top-bar
      // mode toggle can flip straight to the sibling variant.
      const pair = addGeneratedTheme({
        longName,
        palettes: {
          dark: buildPaletteFromSwatches(swatches, "dark"),
          light: buildPaletteFromSwatches(swatches, "light"),
        },
        backgroundImage,
        blurredBackgroundImage,
        blur: blurredBackgroundImage.length > 0 ? DEFAULT_THEME_BLUR : 0,
        scope: ownerScope,
        targetId,
      });
      const applied = pair[mode];

      // Publish the owner's full set of themes so the whole theme
      // (colors + uploaded image URL) reaches other clients. Merge with
      // the stored payload to preserve themes synced from other devices.
      const baseThemes =
        (shareToShelf ? shelfThemesData.data : userThemes.data)?.themes ?? [];
      const mergedById = new Map(baseThemes.map((r) => [r.id, r]));
      mergedById.set(pair.dark.id, pair.dark);
      mergedById.set(pair.light.id, pair.light);
      const ownedThemes = [...mergedById.values()];
      const active: ThemePreference | null = shareToShelf
        ? { mode, light: pair.light.name, dark: pair.dark.name }
        : null;
      try {
        await publish({ scope: ownerScope, targetId }, ownedThemes, active);
        setMessage(
          new SnackbarUpdateImpl(
            shareToShelf
              ? `Theme "${applied.longName}" shared with the shelf`
              : `Theme "${applied.longName}" saved to your account`,
            "success",
          ),
        );
      } catch (err) {
        setMessage(
          new SnackbarUpdateImpl(
            err instanceof Error
              ? `Theme saved locally, but sync failed: ${err.message}`
              : "Theme saved locally, but sync failed",
            "warning",
          ),
        );
      }
      void selectTheme(applied.name);
      resetDraft();
    } catch (err) {
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error
            ? `Could not save theme: ${err.message}`
            : "Could not save theme",
          "error",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack direction="column" spacing={3}>
      <Stack>
        <Typography variant="subtitle1">Theme generator</Typography>
        <Typography variant="body2" color="text.secondary">
          Upload an image and a color scheme is extracted from it. A matched
          dark and light variant are saved together, so the top-bar mode
          toggle switches straight to the sibling.
        </Typography>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <Button
          variant="outlined"
          startIcon={
            analyzing ? <CircularProgress size={16} /> : <AddPhotoIcon />
          }
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
        >
          {analyzing ? "Analyzing..." : "Choose image"}
        </Button>
        <Button
          variant={urlMode ? "contained" : "outlined"}
          startIcon={<LinkIcon />}
          onClick={() => setUrlMode((open) => !open)}
          disabled={analyzing}
        >
          From URL
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFilePicked}
          data-testid="theme-generator-file-input"
        />
      </Stack>

      {urlMode ? (
        <Stack spacing={0.5} sx={{ maxWidth: 560 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <TextField
              fullWidth
              size="small"
              label="Image URL"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleLoadUrl();
                }
              }}
              disabled={analyzing}
              slotProps={{ htmlInput: { "aria-label": "Image URL" } }}
            />
            <Button
              variant="contained"
              onClick={() => void handleLoadUrl()}
              disabled={analyzing || urlInput.trim().length === 0}
            >
              Load
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            The host must allow cross-origin reads (an
            <code> Access-Control-Allow-Origin </code> header). If it does
            not, download the image and use “Choose image”.
          </Typography>
        </Stack>
      ) : null}

      {previewUrl !== null && palette !== null ? (
        <Card variant="outlined" data-testid="theme-generator-preview">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ p: 2 }}
          >
            <Box
              component="img"
              src={previewUrl}
              alt="Uploaded source"
              data-testid="theme-generator-source-image"
              sx={{
                width: { xs: "100%", sm: 180 },
                height: { xs: 160, sm: 130 },
                objectFit: "cover",
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
              >
                <ThemeColorCircles
                  palette={{
                    primary: palette.primary,
                    secondary: palette.secondary,
                    paper: palette.backgroundPaper,
                    default: palette.backgroundDefault,
                  }}
                  circleSize={24}
                  ariaLabel="Generated color preview"
                />
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={mode}
                  onChange={(_, next: ThemeMode | null) => {
                    if (next !== null) setMode(next);
                  }}
                  aria-label="Generated theme mode"
                >
                  <ToggleButton value="light" aria-label="Light mode">
                    <LightModeIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="dark" aria-label="Dark mode">
                    <DarkModeIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <TextField
                label="Theme name"
                size="small"
                value={name}
                onChange={(e) =>
                  setName(e.target.value.slice(0, MAX_THEME_NAME_LENGTH))
                }
                slotProps={{
                  htmlInput: {
                    maxLength: MAX_THEME_NAME_LENGTH,
                    "aria-label": "Generated theme name",
                  },
                }}
              />
              <Stack direction="row" spacing={1}>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={ownerScope}
                  onChange={(_, next: CustomThemeScope | null) => {
                    if (next !== null) setOwnerScope(next);
                  }}
                  aria-label="Theme owner"
                >
                  <ToggleButton value="user">Just me</ToggleButton>
                  <ToggleButton
                    value="shelf"
                    disabled={selectedShelfId === null}
                  >
                    This shelf
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button
                  variant="contained"
                  startIcon={
                    saving || isPublishing ? (
                      <CircularProgress size={16} />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  onClick={() => void handleSave()}
                  disabled={
                    saving ||
                    isPublishing ||
                    name.trim().length === 0 ||
                    (ownerScope === "shelf" && selectedShelfId === null)
                  }
                >
                  {saving || isPublishing ? "Saving..." : "Save theme"}
                </Button>
                <Button onClick={resetDraft}>Discard</Button>
              </Stack>
            </Stack>
          </Stack>
        </Card>
      ) : null}

      <Divider />

      <Stack>
        <Typography variant="subtitle1">Your generated themes</Typography>
        <Typography variant="body2" color="text.secondary">
          Saved themes show up in the theme picker. Each image contributes a
          dark and a light variant; removing either removes the pair.
        </Typography>
      </Stack>

      {generatedThemes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No generated themes yet. Upload an image or paste a URL to create
          one.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {generatedThemes.map((record) => (
            <GeneratedThemeRow
              key={record.id}
              record={record}
              isActive={themeName === record.name}
              onApply={() => void selectTheme(record.name)}
              onEdit={() => setEditing(record)}
              onDelete={() => removeGeneratedTheme(record.id)}
            />
          ))}
        </Stack>
      )}

      <ThemeEditModal
        key={editing?.id ?? "none"}
        record={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </Stack>
  );
};
