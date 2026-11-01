import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DeleteIcon from "@mui/icons-material/Delete";
import LightModeIcon from "@mui/icons-material/LightMode";
import PublishIcon from "@mui/icons-material/Publish";
import SaveIcon from "@mui/icons-material/Save";
import {
  useCustomThemesPreference,
  usePublishCustomThemes,
} from "../../hooks/useCustomThemes";
import type { ThemePreference } from "../../models/Preferences";
import type { GeneratedThemeRecord, ThemeMode } from "../../theme/imageTheme";
import { ThemeColorCircles } from "../../components/ThemeColorCircles";
import { useCachedImageUrl } from "../../hooks/useCachedImageUrl";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface ShelfThemeSectionProps {
  shelfId: string;
}

const themeModeOf = (record: GeneratedThemeRecord): ThemeMode =>
  record.mode === "light" ? "light" : "dark";

/**
 * Theme controls for a single shelf.
 *
 * The shelf owns a `custom-themes` preference row. Editors can publish a
 * generated theme pair to the shelf and pin the shelf's active theme; the
 * pinned theme is offered to members who have not selected one themselves
 * (see `useCustomThemesSync`).
 */
export const ShelfThemeSection: React.FC<ShelfThemeSectionProps> = ({
  shelfId,
}) => {
  const setMessage = useInfoStore((s) => s.setMessage);
  const { data, isLoading } = useCustomThemesPreference({
    scope: "shelf",
    targetId: shelfId,
  });
  const customThemes = useThemeStore((s) => s.customThemes);
  const generatedThemes = useThemeStore((s) => s.generatedThemes);
  const registerSyncedThemes = useThemeStore((s) => s.registerSyncedThemes);
  const { publish, isPublishing } = usePublishCustomThemes();

  // Picker state is seeded from the stored active theme, but a local
  // override wins until the component remounts. This avoids a
  // setState-in-effect when the preference row loads.
  const [override, setOverride] = useState<{
    mode: ThemeMode;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const active = data?.active ?? null;
  const activeMode: ThemeMode = active?.mode === "light" ? "light" : "dark";
  const activeName =
    active === null
      ? ""
      : (activeMode === "light" ? active.light : active.dark) ?? "";
  const mode = override?.mode ?? activeMode;
  const selectedName = override?.name ?? activeName;
  const setMode = (next: ThemeMode) =>
    setOverride({ mode: next, name: selectedName });
  const setSelectedName = (next: string) => setOverride({ mode, name: next });

  // Register this shelf's published themes so their names resolve in the
  // picker even when the shelf is not the app-wide selected shelf.
  useEffect(() => {
    registerSyncedThemes(`shelf:${shelfId}`, data?.themes ?? []);
  }, [shelfId, data, registerSyncedThemes]);

  const modeThemes = useMemo(
    () =>
      customThemes.filter(
        (t) => (t.palette.mode === "light" ? "light" : "dark") === mode,
      ),
    [customThemes, mode],
  );

  const shelfThemes = useMemo(() => data?.themes ?? [], [data]);
  const shelfThemeIds = useMemo(
    () => new Set(shelfThemes.map((r) => r.id)),
    [shelfThemes],
  );

  // Locally generated records whose pair is not on the shelf yet.
  const publishableGroups = useMemo(() => {
    const groups = new Map<string, GeneratedThemeRecord[]>();
    for (const record of generatedThemes) {
      if (shelfThemeIds.has(record.id)) {
        continue;
      }
      const list = groups.get(record.groupId) ?? [];
      list.push(record);
      groups.set(record.groupId, list);
    }
    return [...groups.values()];
  }, [generatedThemes, shelfThemeIds]);

  const buildActive = (): ThemePreference | null => {
    if (selectedName.length === 0) {
      return null;
    }
    const previous = data?.active ?? null;
    return {
      mode,
      light: mode === "light" ? selectedName : (previous?.light ?? null),
      dark: mode === "dark" ? selectedName : (previous?.dark ?? null),
    };
  };

  const mergeThemes = (
    additions: GeneratedThemeRecord[],
  ): GeneratedThemeRecord[] => {
    const byId = new Map(shelfThemes.map((r) => [r.id, r]));
    for (const record of additions) {
      byId.set(record.id, record);
    }
    return [...byId.values()];
  };

  const runPublish = async (
    themes: GeneratedThemeRecord[],
    active: ThemePreference | null,
    successMessage: string,
  ) => {
    setBusy(true);
    try {
      await publish({ scope: "shelf", targetId: shelfId }, themes, active);
      setMessage(new SnackbarUpdateImpl(successMessage, "success"));
    } catch (err) {
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error ? err.message : "Could not update shelf theme",
          "error",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveActive = () =>
    runPublish(shelfThemes, buildActive(), "Shelf theme updated");

  const handleAddGroup = (records: GeneratedThemeRecord[]) =>
    runPublish(
      mergeThemes(records),
      buildActive(),
      "Theme shared with this shelf",
    );

  const handleRemoveGroup = (groupId: string) =>
    runPublish(
      shelfThemes.filter((r) => r.groupId !== groupId),
      buildActive(),
      "Theme removed from this shelf",
    );

  const pending = busy || isPublishing;

  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="subtitle1">Shelf theme</Typography>
        <Typography variant="body2" color="text.secondary">
          Pin a theme for everyone viewing this shelf. Members who have not
          chosen a theme of their own inherit it; publishing a generated theme
          uploads its background image so other clients can render it.
        </Typography>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : null}

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next: ThemeMode | null) => {
            if (next !== null) setMode(next);
          }}
          aria-label="Shelf theme mode"
        >
          <ToggleButton value="light" aria-label="Light mode">
            <LightModeIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="dark" aria-label="Dark mode">
            <DarkModeIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        <Box
          component="select"
          aria-label="Shelf active theme"
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          sx={{
            minWidth: 200,
            height: 40,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
            color: "text.primary",
            px: 1,
          }}
        >
          <option value="">(no shelf theme)</option>
          {modeThemes.map((t) => (
            <option key={t.custom.themeName} value={t.custom.themeName}>
              {t.custom.longName}
            </option>
          ))}
        </Box>
        <Button
          variant="contained"
          startIcon={
            pending ? <CircularProgress size={16} /> : <SaveIcon />
          }
          onClick={() => void handleSaveActive()}
          disabled={pending}
        >
          Save shelf theme
        </Button>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography variant="subtitle2">Themes on this shelf</Typography>
        {shelfThemes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No generated themes shared with this shelf yet.
          </Typography>
        ) : (
          shelfThemes.map((record) => (
            <ShelfThemeRow
              key={record.id}
              record={record}
              onRemove={() => void handleRemoveGroup(record.groupId)}
              disabled={pending}
            />
          ))
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Publish one of your themes</Typography>
        {publishableGroups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Every generated theme you own is already on this shelf.
          </Typography>
        ) : (
          publishableGroups.map((group) => (
            <Card
              key={group[0]?.groupId ?? "group"}
              variant="outlined"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
              }}
            >
              <ThemeColorCircles
                palette={{
                  primary: group[0]!.palette.primary,
                  secondary: group[0]!.palette.secondary,
                  paper: group[0]!.palette.backgroundPaper,
                  default: group[0]!.palette.backgroundDefault,
                }}
                circleSize={20}
                ariaLabel={`${group[0]!.longName} color preview`}
              />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {group[0]!.longName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {group.map((r) => themeModeOf(r)).join(" + ")}
                </Typography>
              </Stack>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PublishIcon fontSize="small" />}
                onClick={() => void handleAddGroup(group)}
                disabled={pending}
              >
                Add to shelf
              </Button>
            </Card>
          ))
        )}
      </Stack>

      {data === null && !isLoading ? (
        <Alert severity="info">
          This shelf has no theme preference yet. Saving one creates it.
        </Alert>
      ) : null}
    </Stack>
  );
};

interface ShelfThemeRowProps {
  record: GeneratedThemeRecord;
  onRemove: () => void;
  disabled: boolean;
}

const ShelfThemeRow: React.FC<ShelfThemeRowProps> = ({
  record,
  onRemove,
  disabled,
}) => {
  const thumbnail = useCachedImageUrl(record.backgroundImage);
  return (
    <Card
      variant="outlined"
      sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5 }}
    >
      {thumbnail !== null ? (
        <Box
          sx={{
            width: 48,
            height: 36,
            flexShrink: 0,
            borderRadius: 1,
            backgroundColor: "action.hover",
            backgroundImage: `url(${thumbnail})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {record.longName}
        </Typography>
      </Stack>
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
      <Tooltip title="Remove theme from shelf">
        <span>
          <IconButton
            aria-label={`Remove ${record.longName} from shelf`}
            onClick={onRemove}
            disabled={disabled}
          >
            <DeleteIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Card>
  );
};
