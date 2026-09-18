import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ColorChip, type ColorChipStatus } from "../../components/ColorChip";
import { CopyButton } from "../../components/CopyButton";
import {
  checkRestApi,
  getStatusApi,
  type ServiceStatus,
  type StatusResponse,
} from "../../api/StatusApi";
import { StatusApiConfigError } from "../../api/StatusApiConfigError";
import {
  REQUIRED_ENV_VARS,
  buildEnvBody,
  type EnvVarSpec,
} from "../../api/StatusApiConfigError";
import { WersuServiceInterface } from "../../api/WersuServiceInterface";
import { BACKEND_BASE } from "../../statics";
import { servicesFromStatus } from "../../components/TopBar/serviceReachabilityModel";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendAgainstContrast } from "../../utils/blendWithContrast";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string; config?: StatusApiConfigError }
  | { kind: "success"; data: StatusResponse };

/**
 * Inline builder for `src/.env`. Lets the user type a value per
 * required variable, then shows the ready-to-paste line(s) with a
 * one-click copy button. Renders the same `required` / `optional`
 * markers as `StatusApiConfigError.example`, so a developer can
 * copy from the message *or* fill in the form.
 */
const EnvVarBuilder: React.FC<{ error: StatusApiConfigError }> = ({
  error,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(REQUIRED_ENV_VARS.map((s) => [s.key, ""])),
  );

  const requiredMissing = REQUIRED_ENV_VARS.filter(
    (s) => !s.optional && !values[s.key].trim(),
  );
  const canEmit = requiredMissing.length === 0;
  const emitted = useMemo(() => (canEmit ? buildEnvBody(values) : ""), [
    canEmit,
    values,
  ]);

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        backgroundColor: (t) =>
          t.palette.mode === "dark"
            ? "rgba(255,255,255,0.02)"
            : "rgba(0,0,0,0.02)",
      }}
    >
      <Typography variant="subtitle2">
        Build your {error.file}
      </Typography>

      {REQUIRED_ENV_VARS.map((spec) => (
        <EnvVarField
          key={spec.key}
          spec={spec}
          value={values[spec.key]}
          onChange={(v) => setValues((prev) => ({ ...prev, [spec.key]: v }))}
        />
      ))}

      {requiredMissing.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          Fill in {requiredMissing.map((s) => s.key).join(", ")} to generate the
          snippet.
        </Typography>
      )}

      {canEmit && (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            borderRadius: 1,
            backgroundColor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(0,0,0,0.4)"
                : "rgba(0,0,0,0.06)",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.85rem",
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
          {emitted}
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <CopyButton
          text={emitted || error.example}
          aria-label="copy env snippet"
          size="small"
          disabled={!canEmit && !error.example}
        />
        <Typography variant="caption" color="text.secondary">
          Paste into <code>{error.file}</code>, then restart <code>npm run dev</code>.
        </Typography>
      </Stack>
    </Stack>
  );
};

/** Single labelled field in the builder. Keeps the spec -> input wiring local. */
const EnvVarField: React.FC<{
  spec: EnvVarSpec;
  value: string;
  onChange: (next: string) => void;
}> = ({ spec, value, onChange }) => (
  <TextField
    label={`${spec.label}${spec.optional ? " (optional)" : ""}`}
    placeholder={spec.placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    size="small"
    fullWidth
    helperText={spec.key}
    slotProps={{ htmlInput: { "aria-label": spec.key, spellCheck: "false" } }}
  />
);

const formatCheckedAt = (checkedAt: string): string => {
  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) {
    return checkedAt;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

/**
 * Card for one :class:`WersuServiceInterface`. Decodes URI-masked
 * credentials in the address before display so the row reads
 * naturally instead of showing URL-encoded asterisks.
 */
const ServiceStatusCard: React.FC<{ service: WersuServiceInterface }> = ({
  service,
}) => {
  const details = service.details();
  const dns = service.dns_status();
  const svc = service.service_status();
  const hasError = !details.reachable && Boolean(details.error);
  const label = details.reachable
    ? "Reachable"
    : hasError
      ? "Unreachable"
      : "Unknown";
  const colorProp: ColorChipStatus = details.reachable
    ? "success"
    : hasError
      ? "error"
      : "warning";

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Typography variant="subtitle1">{service.display_host()}</Typography>
        <ColorChip label={label} colorProp={colorProp} size="small" />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          DNS: {dns.reachable ? "reachable" : dns.error || "unreachable"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Service: {svc.reachable ? "reachable" : svc.error || "unreachable"}
        </Typography>
        {details.detail && (
          <Typography variant="body2" color="text.secondary">
            Detail: {details.detail}
          </Typography>
        )}
        {details.error && !details.reachable && (
          <Alert severity="error" variant="outlined">
            {details.error}
          </Alert>
        )}
      </Stack>
    </Stack>
  );
};

/** Wrap the synthetic REST-API probe in the same interface. */
const restApiService = (status: ServiceStatus): WersuServiceInterface =>
  new WersuServiceInterface("REST API", status);

export const AdministrationSection: React.FC = () => {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [restApiStatus, setRestApiStatus] =
    useState<WersuServiceInterface | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatus = async () => {
    setIsRefreshing(true);
    try {
      const data = await getStatusApi().getStatus();
      setState({ kind: "success", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load status";
      setState({
        kind: "error",
        message,
        config: error instanceof StatusApiConfigError ? error : undefined,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadRestApi = async () => {
    const result = await checkRestApi(BACKEND_BASE);
    setRestApiStatus(restApiService(result));
  };

  useEffect(() => {
    void loadStatus();
    void loadRestApi();

    const interval = window.setInterval(() => {
      void loadStatus();
      void loadRestApi();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const checkedAt = useMemo(
    () =>
      state.kind === "success" ? formatCheckedAt(state.data.checked_at) : null,
    [state],
  );

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="body1">
            Check backend reachability without going through TanStack Query.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The panel refreshes automatically every 30 seconds.
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            void loadStatus();
            void loadRestApi();
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </Stack>

      {isRefreshing && <LinearProgress />}

      {state.kind === "success" && (
        <Alert
          severity={state.data.overall_ok ? "success" : "warning"}
          variant="outlined"
        >
          Overall status: {state.data.overall_ok ? "healthy" : "degraded"}
          {checkedAt ? ` • Checked at ${checkedAt}` : ""}
        </Alert>
      )}

      {restApiStatus && (
        <Stack spacing={1}>
          <Typography variant="subtitle2">{restApiStatus.name()}</Typography>
          <ServiceStatusCard service={restApiStatus} />
        </Stack>
      )}

      {state.kind === "loading" && !restApiStatus && (
        <Typography variant="body2" color="text.secondary">
          Loading status...
        </Typography>
      )}

      {state.kind === "error" && (
        <Stack spacing={1.5}>
          <Alert severity="error" variant="outlined">
            <Typography variant="body2" component="div">
              {state.message}
            </Typography>
          </Alert>
          {state.config && <EnvVarBuilder error={state.config} />}
        </Stack>
      )}

      {state.kind === "success" && (
        <Stack spacing={2}>
          {servicesFromStatus(state.data).map((service) => (
            <Stack key={service.name()} spacing={1}>
              <Typography variant="subtitle2">{service.name()}</Typography>
              <ServiceStatusCard service={service} />
            </Stack>
          ))}
        </Stack>
      )}

      <Divider />

      <Typography variant="caption" color="text.secondary">
        DNS and service probes are reported separately so you can tell routing
        issues from service failures.
      </Typography>
    </Stack>
  );
};
