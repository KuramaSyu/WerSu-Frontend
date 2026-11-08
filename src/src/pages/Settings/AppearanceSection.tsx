import {
  Box,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMemo } from "react";
import {
  CODE_BLOCK_THEMES,
  DOT_GRID_ALGORITHMS,
  MAX_DOT_GRID_DOT_RADIUS,
  MAX_DOT_GRID_FORM_STRENGTH,
  MAX_DOT_GRID_OPACITY,
  MAX_DOT_GRID_RELIEF,
  MAX_DOT_GRID_SPACING,
  MAX_NOTE_EDITOR_BLUR_AMOUNT,
  MIN_DOT_GRID_DOT_RADIUS,
  MIN_DOT_GRID_FORM_STRENGTH,
  MIN_DOT_GRID_OPACITY,
  MIN_DOT_GRID_RELIEF,
  MIN_DOT_GRID_SPACING,
  useAppearanceSettings,
  type CodeBlockTheme,
  type DotGridAlgorithm,
} from "../../zustand/useAppearanceSettings";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import {
  buildDotGridBackground,
  isFormAlgorithm,
} from "../../utils/dotGridBackground";
import { SettingsGroup, SettingsRow } from "./SettingsRow";

/**
 * Pretty labels for the four bundled hljs themes.
 */
const THEME_LABEL: Record<CodeBlockTheme, string> = {
  "tokyo-night-dark": "Tokyo Night (dark)",
  "tokyo-night-light": "Tokyo Night (light)",
  "atom-one-dark": "Atom One (dark)",
  "atom-one-light": "Atom One (light)",
  "gruvbox-dark-pale": "Gruvbox (dark, pale)",
  "gruvbox-light-hard": "Gruvbox (light, hard)",
  "material-palenight": "Material Palenight",
};

const DOT_GRID_ALGORITHM_LABEL: Record<DotGridAlgorithm, string> = {
  hills: "Hills",
  peaks: "Peaks",
  dunes: "Dunes",
  ripples: "Ripples",
  waves: "Waves",
  flat: "Flat",
  terrain: "Terrain",
  swirl: "Swirl",
  warp: "Warp",
};

const DOT_GRID_ALGORITHM_DESCRIPTION: Record<DotGridAlgorithm, string> = {
  hills: "Illumination only. Broad, overlapping Gaussian hills with soft slopes.",
  peaks:
    "Illumination only. The same hills but sharper and narrower, with punchier highlights.",
  dunes:
    "Illumination only. Long, wind-swept ridges running diagonally across the tile.",
  ripples: "Illumination only. Concentric rings radiating from two centres.",
  waves:
    "Illumination only. Interfering sine waves for a gentle undulating surface.",
  flat: "Illumination only. Uniform dots with no relief; min and max illumination collapse to one tone.",
  terrain:
    "Form + illumination. Dots slide downhill along the hill gradient, bunching in valleys and spreading over the crowns.",
  swirl:
    "Form + illumination. A periodic flow field curls the lattice into sweeping currents.",
  warp: "Form + illumination. A smooth vector field warps the rows into organic curves over dune-like ridges.",
};

const ILLUMINATION_ALGORITHMS = DOT_GRID_ALGORITHMS.filter(
  (algorithm) => !isFormAlgorithm(algorithm),
);
const FORM_ALGORITHMS = DOT_GRID_ALGORITHMS.filter(isFormAlgorithm);

interface SettingsSliderRowProps {
  title: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel: string;
}

const SettingsSliderRow: React.FC<SettingsSliderRowProps> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled = false,
  ariaLabel,
}) => (
  <SettingsRow title={title} description={description}>
    <Stack
      direction="row"
      spacing={2}
      sx={{ alignItems: "center", pt: 0.25 }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 52, fontVariantNumeric: "tabular-nums" }}
      >
        {format(value)}
      </Typography>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(_, next) => onChange(next as number)}
        aria-label={ariaLabel}
        sx={{ maxWidth: 360 }}
      />
    </Stack>
  </SettingsRow>
);

interface SettingsRangeSliderRowProps {
  title: string;
  description?: string;
  value: [number, number];
  min: number;
  max: number;
  step: number;
  format: (value: [number, number]) => string;
  onChange: (value: [number, number]) => void;
  disabled?: boolean;
  ariaLabel: string;
}

const SettingsRangeSliderRow: React.FC<SettingsRangeSliderRowProps> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled = false,
  ariaLabel,
}) => (
  <SettingsRow title={title} description={description}>
    <Stack
      direction="row"
      spacing={2}
      sx={{ alignItems: "center", pt: 0.25 }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 72, fontVariantNumeric: "tabular-nums" }}
      >
        {format(value)}
      </Typography>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        valueLabelDisplay="auto"
        valueLabelFormat={(next) => `${Math.round(next * 100)}%`}
        onChange={(_, next) => onChange(next as [number, number])}
        aria-label={ariaLabel}
        sx={{ maxWidth: 360 }}
      />
    </Stack>
  </SettingsRow>
);

/**
 * Body of the Settings `Appearance` category. Exposes one picker per
 * MUI color mode so light/dark UI gets separate token palettes, and a
 * developer-mode toggle for extra debug surfaces.
 *
 * Code-block theme choices live in `useAppearanceSettings`
 * (sessionStorage), so they reset when the browser session ends and
 * never ride on API cookies. The developer-mode flag lives in
 * `useFeatureStore` (localStorage) — it survives across sessions by
 * design, since it's a sticky debug preference.
 */
export const AppearanceSection: React.FC = () => {
  const theme = useTheme();
  const {
    codeBlockThemeLight,
    codeBlockThemeDark,
    noteEditorBackgroundBlurAmount,
    dotGridEnabled,
    dotGridAlgorithm,
    dotGridSpacing,
    dotGridMinOpacity,
    dotGridMaxOpacity,
    dotGridLightAngle,
    dotGridRelief,
    dotGridDotRadius,
    dotGridFormStrength,
    dotGridUniformIllumination,
    dotGridUniformOpacity,
    setCodeBlockThemeLight,
    setCodeBlockThemeDark,
    setNoteEditorBackgroundBlurAmount,
    setDotGridEnabled,
    setDotGridAlgorithm,
    setDotGridSpacing,
    setDotGridIlluminationRange,
    setDotGridUniformIllumination,
    setDotGridUniformOpacity,
    setDotGridLightAngle,
    setDotGridRelief,
    setDotGridDotRadius,
    setDotGridFormStrength,
  } = useAppearanceSettings();

  const dotGridHasForm = isFormAlgorithm(dotGridAlgorithm);
  const illuminationControlsDisabled =
    !dotGridEnabled || dotGridUniformIllumination || dotGridAlgorithm === "flat";

  const dotGridPreview = useMemo(
    () =>
      buildDotGridBackground({
        color: theme.palette.text.primary,
        algorithm: dotGridAlgorithm,
        spacing: dotGridSpacing,
        minOpacity: dotGridMinOpacity,
        maxOpacity: dotGridMaxOpacity,
        lightAngle: dotGridLightAngle,
        relief: dotGridRelief,
        dotRadius: dotGridDotRadius,
        formStrength: dotGridFormStrength,
        uniformIllumination: dotGridUniformIllumination,
        uniformOpacity: dotGridUniformOpacity,
      }),
    [
      theme.palette.text.primary,
      dotGridAlgorithm,
      dotGridSpacing,
      dotGridMinOpacity,
      dotGridMaxOpacity,
      dotGridLightAngle,
      dotGridRelief,
      dotGridDotRadius,
      dotGridFormStrength,
      dotGridUniformIllumination,
      dotGridUniformOpacity,
    ],
  );
  const flatLayout = useFeatureStore(
    (state) => state.flags[FeatureFlagName.FlatLayout],
  );
  const noteEditorBackgroundBlur = useFeatureStore(
    (state) => state.flags[FeatureFlagName.NoteEditorBackgroundBlur],
  );
  const preRenderThemeBlur = useFeatureStore(
    (state) => state.flags[FeatureFlagName.PreRenderThemeBlur],
  );
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );
  const setFlag = useFeatureStore((state) => state.setFlag);

  return (
    <Stack spacing={2}>
      <SettingsGroup title="Layout">
        <SettingsRow
          title="Flat layout"
          description="Paint the main content and right panel with the base background color instead of the paper tone, so the shell reads as one flat surface."
          control={
            <Switch
              checked={flatLayout}
              onChange={(_, checked) =>
                setFlag(FeatureFlagName.FlatLayout, checked)
              }
              slotProps={{ input: { "aria-label": "Flat layout toggle" } }}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Outlet dot grid"
        description="Procedural texture painted on the main content area when the active theme has no background image."
      >
        <SettingsRow
          title="Show dot grid"
          description="Turn the texture off entirely. It is hidden automatically whenever a theme background image is painted."
          control={
            <Switch
              checked={dotGridEnabled}
              onChange={(_, checked) => setDotGridEnabled(checked)}
              slotProps={{ input: { "aria-label": "Outlet dot grid toggle" } }}
            />
          }
        />

        <SettingsRow
          title="Pattern"
          description={DOT_GRID_ALGORITHM_DESCRIPTION[dotGridAlgorithm]}
          control={
            <FormControl
              size="small"
              sx={{ minWidth: 220 }}
              disabled={!dotGridEnabled}
            >
              <InputLabel id="dot-grid-algorithm-label">Pattern</InputLabel>
              <Select
                labelId="dot-grid-algorithm-label"
                label="Pattern"
                value={dotGridAlgorithm}
                onChange={(event) =>
                  setDotGridAlgorithm(event.target.value as DotGridAlgorithm)
                }
              >
                <ListSubheader>Illumination only</ListSubheader>
                {ILLUMINATION_ALGORITHMS.map((algorithm) => (
                  <MenuItem key={algorithm} value={algorithm}>
                    {DOT_GRID_ALGORITHM_LABEL[algorithm]}
                  </MenuItem>
                ))}
                <ListSubheader>Illumination + form</ListSubheader>
                {FORM_ALGORITHMS.map((algorithm) => (
                  <MenuItem key={algorithm} value={algorithm}>
                    {DOT_GRID_ALGORITHM_LABEL[algorithm]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <SettingsRow
          title="Preview"
          description="Live preview of the selected pattern using the current theme colours."
        >
          <Box
            aria-label="Dot grid preview"
            sx={{
              mt: 0.5,
              height: 96,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: flatLayout
                ? theme.palette.background.default
                : theme.palette.background.paper,
              backgroundImage: dotGridPreview.image,
              backgroundSize: dotGridPreview.size,
              opacity: dotGridEnabled ? 1 : 0.4,
              overflow: "hidden",
            }}
          />
        </SettingsRow>

        <SettingsSliderRow
          title="Spacing"
          description="Distance between dot centres. The hill scale stays roughly constant, so only the dot density changes."
          value={dotGridSpacing}
          min={MIN_DOT_GRID_SPACING}
          max={MAX_DOT_GRID_SPACING}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={setDotGridSpacing}
          disabled={!dotGridEnabled}
          ariaLabel="Dot grid spacing"
        />

        <SettingsRow
          title="Uniform illumination"
          description="Use one opacity and size for every dot. Form patterns still move the dots, but the lighting range is ignored."
          control={
            <Switch
              checked={dotGridUniformIllumination}
              onChange={(_, checked) => setDotGridUniformIllumination(checked)}
              disabled={!dotGridEnabled}
              slotProps={{
                input: { "aria-label": "Uniform dot illumination toggle" },
              }}
            />
          }
        />

        {dotGridUniformIllumination ? (
          <SettingsSliderRow
            title="Illumination"
            description="Opacity applied to every dot."
            value={dotGridUniformOpacity}
            min={MIN_DOT_GRID_OPACITY}
            max={MAX_DOT_GRID_OPACITY}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={setDotGridUniformOpacity}
            disabled={!dotGridEnabled}
            ariaLabel="Dot grid uniform illumination"
          />
        ) : (
          <SettingsRangeSliderRow
            title="Illumination range"
            description="Opacity of the darkest and brightest dots. Drag either thumb; both stay on the same fixed track."
            value={[dotGridMinOpacity, dotGridMaxOpacity]}
            min={MIN_DOT_GRID_OPACITY}
            max={MAX_DOT_GRID_OPACITY}
            step={0.01}
            format={([min, max]) =>
              `${Math.round(min * 100)}% – ${Math.round(max * 100)}%`
            }
            onChange={([min, max]) => setDotGridIlluminationRange(min, max)}
            disabled={!dotGridEnabled}
            ariaLabel="Dot grid illumination range"
          />
        )}

        <SettingsSliderRow
          title="Light angle"
          description="Direction the relief is lit from. 225° is the upper-left."
          value={dotGridLightAngle}
          min={0}
          max={360}
          step={5}
          format={(value) => `${Math.round(value)}°`}
          onChange={setDotGridLightAngle}
          disabled={illuminationControlsDisabled}
          ariaLabel="Dot grid light angle"
        />

        <SettingsSliderRow
          title="Relief"
          description="How strongly the height field is exaggerated. Higher values make the highlights and shadows more dramatic."
          value={dotGridRelief}
          min={MIN_DOT_GRID_RELIEF}
          max={MAX_DOT_GRID_RELIEF}
          step={0.1}
          format={(value) => value.toFixed(1)}
          onChange={setDotGridRelief}
          disabled={illuminationControlsDisabled}
          ariaLabel="Dot grid relief"
        />

        <SettingsSliderRow
          title="Dot size"
          description="Base radius of each dot. Lit dots are drawn slightly larger than shadowed ones."
          value={dotGridDotRadius}
          min={MIN_DOT_GRID_DOT_RADIUS}
          max={MAX_DOT_GRID_DOT_RADIUS}
          step={0.05}
          format={(value) => `${value.toFixed(2)} px`}
          onChange={setDotGridDotRadius}
          disabled={!dotGridEnabled}
          ariaLabel="Dot grid dot size"
        />

        <SettingsSliderRow
          title="Form strength"
          description="Displacement amplitude for the Illumination + form patterns, in dot cells. 0 keeps the lattice straight; higher values push dots further along the terrain or flow field."
          value={dotGridFormStrength}
          min={MIN_DOT_GRID_FORM_STRENGTH}
          max={MAX_DOT_GRID_FORM_STRENGTH}
          step={0.1}
          format={(value) => `${value.toFixed(1)} cells`}
          onChange={setDotGridFormStrength}
          disabled={!dotGridEnabled || !dotGridHasForm}
          ariaLabel="Dot grid form strength"
        />
      </SettingsGroup>

      <SettingsGroup title="Note editor effects">
        <SettingsRow
          title="Background blur"
          description="Blur the theme background image behind the note editor. Only active when the current theme has a background image. Turn it off for better performance on slower devices."
          control={
            <Switch
              checked={noteEditorBackgroundBlur}
              onChange={(_, checked) =>
                setFlag(FeatureFlagName.NoteEditorBackgroundBlur, checked)
              }
              slotProps={{
                input: { "aria-label": "Note editor background blur toggle" },
              }}
            />
          }
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", pt: 0.25 }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 44, fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(noteEditorBackgroundBlurAmount)} px
            </Typography>
            <Slider
              value={noteEditorBackgroundBlurAmount}
              min={0}
              max={MAX_NOTE_EDITOR_BLUR_AMOUNT}
              step={1}
              disabled={!noteEditorBackgroundBlur}
              onChange={(_, value) =>
                setNoteEditorBackgroundBlurAmount(value as number)
              }
              aria-label="Note editor background blur amount"
              sx={{ maxWidth: 360 }}
            />
          </Stack>
        </SettingsRow>

        <SettingsRow
          title="Pre-render blurred backgrounds"
          description="Store a second, pre-blurred copy of the theme image in IndexedDB (two cached copies) so the background renders instantly. Turn this off to instead fetch the image at screen resolution (1080p / 720p) and apply the blur on the fly — only the sharp source is cached."
          control={
            <Switch
              checked={preRenderThemeBlur}
              onChange={(_, checked) =>
                setFlag(FeatureFlagName.PreRenderThemeBlur, checked)
              }
              slotProps={{
                input: {
                  "aria-label": "Pre-render blurred theme backgrounds toggle",
                },
              }}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Code blocks"
        description="Pick the syntax theme used by code blocks in the note editor. Light and dark are independent so each UI mode can have its own."
      >
        <SettingsRow
          title="Light theme"
          control={
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="cb-theme-light-label">Light theme</InputLabel>
              <Select
                labelId="cb-theme-light-label"
                label="Light theme"
                value={codeBlockThemeLight}
                onChange={(e) =>
                  setCodeBlockThemeLight(e.target.value as CodeBlockTheme)
                }
              >
                {CODE_BLOCK_THEMES.map((theme) => (
                  <MenuItem key={theme} value={theme}>
                    {THEME_LABEL[theme]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <SettingsRow
          title="Dark theme"
          control={
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="cb-theme-dark-label">Dark theme</InputLabel>
              <Select
                labelId="cb-theme-dark-label"
                label="Dark theme"
                value={codeBlockThemeDark}
                onChange={(e) =>
                  setCodeBlockThemeDark(e.target.value as CodeBlockTheme)
                }
              >
                {CODE_BLOCK_THEMES.map((theme) => (
                  <MenuItem key={theme} value={theme}>
                    {THEME_LABEL[theme]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Developer">
        <SettingsRow
          title="Developer mode"
          description="Show extra debug information in tooltips and other surfaces that are normally hidden."
          control={
            <Switch
              checked={developerMode}
              onChange={(_, checked) =>
                setFlag(FeatureFlagName.DeveloperMode, checked)
              }
              slotProps={{ input: { "aria-label": "Developer mode toggle" } }}
            />
          }
        />
      </SettingsGroup>
    </Stack>
  );
};
