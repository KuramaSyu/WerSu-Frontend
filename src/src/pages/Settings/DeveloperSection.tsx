import { Alert, Stack, Switch, Typography } from "@mui/material";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { ThemeManager } from "../../theme/themeManager";

/**
 * Developer-only settings.
 *
 * Hidden entirely unless `DeveloperMode` is on. The "Fake API" toggle
 * is a separate flag so end users can't accidentally enable it via the
 * URL — and it persists independently so a developer can keep
 * DeveloperMode off while still occasionally testing the fake backend.
 *
 * The actual worker start/stop logic lives in
 * `Bootstrap.useFakeApiMode`; this component just owns the UI bit.
 */
export const DeveloperSection: React.FC = () => {
  const developerMode = useFeatureStore(
    (s) => s.flags[FeatureFlagName.DeveloperMode],
  );
  const useFakeApi = useFeatureStore(
    (s) => s.flags[FeatureFlagName.UseFakeApi],
  );
  const themeDebug = useFeatureStore(
    (s) => s.flags[FeatureFlagName.ThemeDebug],
  );
  const blurredBackgroundDebug = useFeatureStore(
    (s) => s.flags[FeatureFlagName.BlurredBackgroundDebug],
  );
  const backgroundImageDebug = useFeatureStore(
    (s) => s.flags[FeatureFlagName.BackgroundImageDebug],
  );
  const setFlag = useFeatureStore((s) => s.setFlag);

  if (!developerMode) {
    return (
      <Alert severity="info">
        Enable Developer mode in Appearance to access developer settings.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack>
        <Typography variant="subtitle1">Theme generation debug</Typography>
        <Typography variant="body2" color="text.secondary">
          Dump a step-by-step trace of every theme generation to the browser
          console (URL routing, fetch status, blob/image timing, vibrant
          swatches, resolved palette). Also flips the in-process
          ThemeManager.debug static for the current session.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Switch
          checked={themeDebug}
          onChange={(e) => {
            setFlag(FeatureFlagName.ThemeDebug, e.target.checked);
            // Mirror onto the static so the toggle is visible in
            // ThemeManager itself, not just the feature store.
            ThemeManager.debug = e.target.checked;
          }}
          slotProps={{ input: { "aria-label": "Theme generation debug" } }}
        />
        <Typography>
          {themeDebug ? "Theme debug is on" : "Theme debug is off"}
        </Typography>
      </Stack>

      <Stack>
        <Typography variant="subtitle1">Blurred background debug</Typography>
        <Typography variant="body2" color="text.secondary">
          Log a one-line summary to the browser console each time the
          AppBackground blur pipeline starts, finishes, or falls back to the raw
          URL. Per-frame cost is zero. Filter the DevTools console by{" "}
          <code>[blur]</code> to see only these lines.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Switch
          checked={blurredBackgroundDebug}
          onChange={(e) =>
            setFlag(FeatureFlagName.BlurredBackgroundDebug, e.target.checked)
          }
          slotProps={{
            input: { "aria-label": "Blurred background debug" },
          }}
        />
        <Typography>
          {blurredBackgroundDebug
            ? "Blurred background debug is on"
            : "Blurred background debug is off"}
        </Typography>
      </Stack>

      <Stack>
        <Typography variant="subtitle1">Background image debug</Typography>
        <Typography variant="body2" color="text.secondary">
          Trace the background-image upload + IndexedDB blob cache
          pipeline (file pick, downscale timing, cache hits, IDB
          open/put timings, stuck writes) to the browser console.
          Per-frame cost is zero. Filter the DevTools console by{" "}
          <code>[bg-debug]</code> to see only these lines.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Switch
          checked={backgroundImageDebug}
          onChange={(e) =>
            setFlag(FeatureFlagName.BackgroundImageDebug, e.target.checked)
          }
          slotProps={{
            input: { "aria-label": "Background image debug" },
          }}
        />
        <Typography>
          {backgroundImageDebug
            ? "Background image debug is on"
            : "Background image debug is off"}
        </Typography>
      </Stack>

      <Stack>
        <Typography variant="subtitle1">Fake API (MSW)</Typography>
        <Typography variant="body2" color="text.secondary">
          Route every <code>/api/*</code> request through an in-browser MSW
          worker. Useful when the backend is unreachable or you want a known
          dataset. Only available in dev builds.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Switch
          checked={useFakeApi}
          onChange={(e) =>
            setFlag(FeatureFlagName.UseFakeApi, e.target.checked)
          }
          slotProps={{ input: { "aria-label": "Use fake API (MSW)" } }}
        />
        <Typography>
          {useFakeApi ? "Fake API is on" : "Fake API is off"}
        </Typography>
      </Stack>

      {useFakeApi && (
        <Alert severity="warning">
          The backend is being bypassed. Mutations affect an in-memory fixture
          that resets on full page reload.
        </Alert>
      )}
    </Stack>
  );
};
