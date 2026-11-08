import { Chip, Stack, Typography } from "@mui/material";
import { useDevicePerformanceHint } from "../../hooks/useDevicePerformanceHint";
import { PerformanceModeSection } from "./PerformanceModeSection";

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
    <Stack direction="column" spacing={3}>
      <Stack direction="column" spacing={1.5}>
        <Typography variant="subtitle1">Network status</Typography>
        <Typography variant="body2" color="text.secondary">
          These hints come from the browser&apos;s Network Information API and a
          short frame-pacing sample. Performance mode is enabled automatically
          when the network drops below 4G; device-only hints are used to
          recommend it.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip size="small" color={statusColor} label={statusLabel} />
          <Chip
            size="small"
            variant="outlined"
            label={`Network: ${networkQualityLabel}`}
          />
          <Chip size="small" variant="outlined" label={`Device: ${hint}`} />
          {reasons.map((reason) => (
            <Chip key={reason} size="small" variant="outlined" label={reason} />
          ))}
        </Stack>
      </Stack>

      <PerformanceModeSection />
    </Stack>
  );
};

export default NetworkSection;
