import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import {
  CODE_BLOCK_THEMES,
  MAX_NOTE_EDITOR_BLUR_AMOUNT,
  useAppearanceSettings,
  type CodeBlockTheme,
} from "../../zustand/useAppearanceSettings";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
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
  const {
    codeBlockThemeLight,
    codeBlockThemeDark,
    noteEditorBackgroundBlurAmount,
    setCodeBlockThemeLight,
    setCodeBlockThemeDark,
    setNoteEditorBackgroundBlurAmount,
  } = useAppearanceSettings();
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
