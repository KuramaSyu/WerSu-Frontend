import {
  Alert,
  AlertTitle,
  Button,
  Chip,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { useDevicePerformanceHint } from "../../hooks/useDevicePerformanceHint";

/**
 * Performance mode master switch + sub-flags.
 *
 * Lives in Settings > Network so the device/connection hint and the
 * controls that react to it sit together. The avatar menu renders the same
 * controls as a shortcut when a slow connection is detected.
 */
export const PerformanceModeSection: React.FC = () => {
  const performanceMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.PerformanceMode],
  );
  const reduceMotion = useFeatureStore(
    (state) => state.flags[FeatureFlagName.ReduceMotion],
  );
  const disableBlur = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DisableBlur],
  );
  const ignoreBackgroundImage = useFeatureStore(
    (state) => state.flags[FeatureFlagName.IgnoreBackgroundImage],
  );
  const setFlag = useFeatureStore((state) => state.setFlag);
  const setPerformanceMode = useFeatureStore(
    (state) => state.setPerformanceMode,
  );
  const {
    hint,
    isConstrained: isConstrainedDevice,
    isSlowConnection,
    isRecommendationDismissed,
    dismissRecommendation,
  } = useDevicePerformanceHint();
  const showPerformanceRecommendation =
    !performanceMode &&
    !isRecommendationDismissed &&
    (isConstrainedDevice || isSlowConnection);
  const detectionHint = isSlowConnection
    ? "Slow connection detected — Performance mode is recommended."
    : isConstrainedDevice
      ? "This device looks constrained — Performance mode is recommended."
      : null;
  const statusLabel = isSlowConnection
    ? "Slow connection detected"
    : isConstrainedDevice
      ? "Performance issue detected"
      : "No performance issue detected";
  const statusColor = isSlowConnection
    ? "warning"
    : isConstrainedDevice
      ? "info"
      : "success";

  return (
    <Stack
      direction="column"
      spacing={2}
      sx={{
        py: 1.5,
        borderTop: 1,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {showPerformanceRecommendation && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={dismissRecommendation}
            >
              Dismiss
            </Button>
          }
        >
          <AlertTitle>Performance mode recommended</AlertTitle>
          This device or connection looks constrained. Enable Performance mode
          to reduce animation and blur work.
          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => setPerformanceMode(true)}
            >
              Enable Performance mode
            </Button>
          </Stack>
        </Alert>
      )}
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Stack direction="column" spacing={1}>
          <Typography variant="subtitle1">Performance mode</Typography>
          <Typography variant="body2" color="text.secondary">
            Reduce visual effects for low-end devices. Enabling this turns on
            all three sub-options below; you can switch any of them off
            individually afterwards.
          </Typography>
          {detectionHint !== null && (
            <Typography variant="caption" color="text.secondary">
              {detectionHint}
            </Typography>
          )}
        </Stack>
        <Switch
          checked={performanceMode}
          onChange={(_, checked) => setPerformanceMode(checked)}
          slotProps={{
            input: { "aria-label": "Performance mode toggle" },
          }}
        />
      </Stack>

      <Stack spacing={2} sx={{ pl: { xs: 0, sm: 2 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="column" spacing={0.5}>
            <Typography variant="subtitle2">Reduce motion</Typography>
            <Typography variant="body2" color="text.secondary">
              Suppress non-essential animations and transitions across the app.
            </Typography>
          </Stack>
          <Switch
            checked={reduceMotion}
            disabled={!performanceMode}
            onChange={(_, checked) =>
              setFlag(FeatureFlagName.ReduceMotion, checked)
            }
            slotProps={{
              input: { "aria-label": "Reduce motion toggle" },
            }}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="column" spacing={0.5}>
            <Typography variant="subtitle2">Disable blur</Typography>
            <Typography variant="body2" color="text.secondary">
              Skip the theme-background and note-editor blur passes. The sharp
              background is shown instead.
            </Typography>
          </Stack>
          <Switch
            checked={disableBlur}
            disabled={!performanceMode}
            onChange={(_, checked) =>
              setFlag(FeatureFlagName.DisableBlur, checked)
            }
            slotProps={{
              input: { "aria-label": "Disable blur toggle" },
            }}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="column" spacing={0.5}>
            <Typography variant="subtitle2">Ignore background image</Typography>
            <Typography variant="body2" color="text.secondary">
              Keep the colours calculated from a theme image, but do not paint
              the image itself.
            </Typography>
          </Stack>
          <Switch
            checked={ignoreBackgroundImage}
            disabled={!performanceMode}
            onChange={(_, checked) =>
              setFlag(FeatureFlagName.IgnoreBackgroundImage, checked)
            }
            slotProps={{
              input: { "aria-label": "Ignore background image toggle" },
            }}
          />
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Chip size="small" color={statusColor} label={statusLabel} />
        <Chip size="small" variant="outlined" label={`Hint: ${hint}`} />
      </Stack>
    </Stack>
  );
};

export default PerformanceModeSection;
