import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import {
  CODE_BLOCK_THEMES,
  useAppearanceSettings,
  type CodeBlockTheme,
} from "../../zustand/useAppearanceSettings";

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
 * MUI color mode so light/dark UI gets separate token palettes.
 *
 * Choices live in `useAppearanceSettings` (sessionStorage), so they
 * reset when the browser session ends and never ride on API cookies.
 */
export const AppearanceSection: React.FC = () => {
  const {
    codeBlockThemeLight,
    codeBlockThemeDark,
    setCodeBlockThemeLight,
    setCodeBlockThemeDark,
  } = useAppearanceSettings();

  return (
    <Stack direction="column" spacing={3}>
      <Stack>
        <Typography variant="subtitle1">Code blocks</Typography>
        <Typography variant="body2" color="text.secondary">
          Pick the syntax-theme used by code blocks in the note editor. Light +
          dark are independent so each UI mode can have its own.
        </Typography>
      </Stack>

      <FormControl size="small" sx={{ maxWidth: 320 }}>
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

      <FormControl size="small" sx={{ maxWidth: 320 }}>
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
    </Stack>
  );
};
