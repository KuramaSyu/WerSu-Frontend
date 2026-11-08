import { Chip, Stack, Typography } from "@mui/material";
import { useDevicePerformanceHint } from "../../hooks/useDevicePerformanceHint";
import { PerformanceModeSection } from "./PerformanceModeSection";

/**
 * Settings > Network. Surfaces the coarse device/connection hint used to
 * recommend Performance mode, plus the controls that react to it.
 */
export const NetworkSection: React.FC = () => {
  const { hint, isSlowConnection, isConstrained, reasons } =
    useDevicePerformanceHint();

  const statusLabel = isSlowConnection
    ? "Slow connection detected"
    : isConstrained
      ? "Constrained device detected"
      : "No slow connection detected";
  const statusColor = isSlowConnection
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
          short frame-pacing sample. They are intentionally conservative and are
          only used to suggest Performance mode — never to enable it silently.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip size="small" color={statusColor} label={statusLabel} />
          <Chip size="small" variant="outlined" label={`Hint: ${hint}`} />
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
