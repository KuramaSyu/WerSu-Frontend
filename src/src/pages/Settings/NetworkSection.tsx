import { Box, Chip, Stack } from "@mui/material";
import { useDevicePerformanceHint } from "../../hooks/useDevicePerformanceHint";
import { PerformanceModeSection } from "./PerformanceModeSection";
import { SettingsGroup } from "./SettingsRow";

/**
 * Settings > Network. Surfaces the coarse device/connection hint used to
 * recommend Performance mode, plus the controls that react to it.
 */
export const NetworkSection: React.FC = () => {
  const {
    hint,
    networkQualityLabel,
    isBelow4G,
    isSlowConnection,
    isConstrained,
    reasons,
  } = useDevicePerformanceHint();

  const statusLabel = isBelow4G
    ? `${networkQualityLabel} network detected`
    : isSlowConnection
      ? "Slow connection detected"
      : isConstrained
        ? "Constrained device detected"
        : "No slow connection detected";
  const statusColor =
    isBelow4G || isSlowConnection
      ? "warning"
      : isConstrained
        ? "info"
        : "success";

  return (
    <Stack spacing={2}>
      <SettingsGroup
        title="Network status"
        description="These hints come from the browser's Network Information API and a short frame-pacing sample. Performance mode is enabled automatically when the network drops below 4G; device-only hints are used to recommend it."
      >
        <Box sx={{ py: 2 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip size="small" color={statusColor} label={statusLabel} />
            <Chip
              size="small"
              variant="outlined"
              label={`Network: ${networkQualityLabel}`}
            />
            <Chip size="small" variant="outlined" label={`Device: ${hint}`} />
            {reasons.map((reason) => (
              <Chip
                key={reason}
                size="small"
                variant="outlined"
                label={reason}
              />
            ))}
          </Stack>
        </Box>
      </SettingsGroup>

      <PerformanceModeSection />
    </Stack>
  );
};

export default NetworkSection;
