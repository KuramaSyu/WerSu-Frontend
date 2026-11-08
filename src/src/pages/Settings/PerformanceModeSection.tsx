import {
  Alert,
  AlertTitle,
  Button,
  Stack,
  Switch,
} from "@mui/material";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { useDevicePerformanceHint } from "../../hooks/useDevicePerformanceHint";
import { SettingsGroup, SettingsRow } from "./SettingsRow";

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
    networkQualityLabel,
    isBelow4G,
    isConstrained: isConstrainedDevice,
    isSlowConnection,
    isRecommendationDismissed,
    dismissRecommendation,
  } = useDevicePerformanceHint();
  const showPerformanceRecommendation =
    !performanceMode &&
    !isRecommendationDismissed &&
    (isConstrainedDevice || isSlowConnection);
  const detectionHint = isBelow4G
    ? performanceMode
      ? `${networkQualityLabel} network detected — Performance mode is enabled.`
      : `${networkQualityLabel} network detected — Performance mode is recommended.`
    : isSlowConnection
      ? "Slow connection detected — Performance mode is recommended."
      : isConstrainedDevice
        ? "This device looks constrained — Performance mode is recommended."
        : null;
  const detectionSummary =
    isBelow4G
      ? `${networkQualityLabel} network`
      : isSlowConnection
        ? "Slow connection"
        : isConstrainedDevice
          ? "Constrained device"
          : null;

  return (
    <Stack spacing={2}>
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
          This device or connection looks constrained ({detectionSummary ?? hint}
          ). Enable Performance mode to reduce animation and blur work.
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

      <SettingsGroup
        title="Performance mode"
        description="Reduce visual effects for low-end devices and slow connections. Turning Performance mode on also enables all three sub-options below; you can switch any of them off individually afterwards."
      >
        <SettingsRow
          title="Enable performance mode"
          description={
            detectionHint ??
            "Automatically suggested when the network drops below 4G or the device looks constrained."
          }
          control={
            <Switch
              checked={performanceMode}
              onChange={(_, checked) => setPerformanceMode(checked)}
              slotProps={{
                input: { "aria-label": "Performance mode toggle" },
              }}
            />
          }
        />

        <SettingsRow
          title="Reduce motion"
          description="Suppress non-essential animations and transitions across the app."
          control={
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
          }
        />

        <SettingsRow
          title="Disable blur"
          description="Skip the theme-background and note-editor blur passes. The sharp background is shown instead."
          control={
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
          }
        />

        <SettingsRow
          title="Ignore background image"
          description="Keep the colours calculated from a theme image, but do not paint the image itself."
          control={
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
          }
        />
      </SettingsGroup>
    </Stack>
  );
};

export default PerformanceModeSection;
