import { Alert, Stack, Switch } from "@mui/material";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { ThemeManager } from "../../theme/themeManager";
import { AllPreferencesAccordion } from "./AllPreferencesAccordion";
import { SettingsGroup, SettingsRow } from "./SettingsRow";

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
    <Stack spacing={2}>
      <SettingsGroup
        title="Debug logging"
        description="Extra console tracing for theme and background pipelines. All logs are opt-in and have zero per-frame cost."
      >
        <SettingsRow
          title="Theme generation"
          description={
            <>
              Dump a step-by-step trace of every theme generation to the browser
              console (URL routing, fetch status, blob/image timing, vibrant
              swatches, resolved palette). Also flips the in-process
              <code> ThemeManager.debug </code>
              static for the current session.
            </>
          }
          control={
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
          }
        />

        <SettingsRow
          title="Blurred background"
          description={
            <>
              Log a one-line summary each time a blurred background variant is
              generated (theme save/edit). Filter the DevTools console by
              <code> [blur] </code>
              to see only these lines.
            </>
          }
          control={
            <Switch
              checked={blurredBackgroundDebug}
              onChange={(e) =>
                setFlag(
                  FeatureFlagName.BlurredBackgroundDebug,
                  e.target.checked,
                )
              }
              slotProps={{
                input: { "aria-label": "Blurred background debug" },
              }}
            />
          }
        />

        <SettingsRow
          title="Image upload"
          description={
            <>
              Trace the theme image upload and IndexedDB blob cache pipeline
              (file pick, downscale timing, cache hits, IDB open/put timings,
              stuck writes). Filter the DevTools console by
              <code> [bg-debug] </code>
              to see only these lines.
            </>
          }
          control={
            <Switch
              checked={backgroundImageDebug}
              onChange={(e) =>
                setFlag(FeatureFlagName.BackgroundImageDebug, e.target.checked)
              }
              slotProps={{
                input: { "aria-label": "Image upload debug" },
              }}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Backend"
        description="Route API traffic through an in-browser mock server."
      >
        <SettingsRow
          title="Fake API (MSW)"
          description={
            <>
              Route every <code>/api/*</code> request through an in-browser MSW
              worker. Useful when the backend is unreachable or you want a known
              dataset. Only available in dev builds.
            </>
          }
          control={
            <Switch
              checked={useFakeApi}
              onChange={(e) =>
                setFlag(FeatureFlagName.UseFakeApi, e.target.checked)
              }
              slotProps={{ input: { "aria-label": "Use fake API (MSW)" } }}
            />
          }
        />
        {useFakeApi && (
          <Alert severity="warning" sx={{ my: 2 }}>
            The backend is being bypassed. Mutations affect an in-memory fixture
            that resets on full page reload.
          </Alert>
        )}
      </SettingsGroup>

      <AllPreferencesAccordion />
    </Stack>
  );
};
