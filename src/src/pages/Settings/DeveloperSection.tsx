import {
  Alert,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";

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
        <Typography variant="subtitle1">Fake API (MSW)</Typography>
        <Typography variant="body2" color="text.secondary">
          Route every <code>/api/*</code> request through an in-browser MSW
          worker. Useful when the backend is unreachable or you want a known
          dataset. Only available in dev builds.
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={2}>
        <Switch
          checked={useFakeApi}
          onChange={(e) =>
            setFlag(FeatureFlagName.UseFakeApi, e.target.checked)
          }
          inputProps={{ "aria-label": "Use fake API (MSW)" }}
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
