import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ColorChip, type ColorChipStatus } from "../../components/ColorChip";
import {
  checkRestApi,
  getStatusApi,
  type ServiceStatus,
  type StatusResponse,
} from "../../api/StatusApi";
import { BACKEND_BASE } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendAgainstContrast } from "../../utils/blendWithContrast";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; data: StatusResponse };

const serviceLabel: Record<
  keyof Pick<
    StatusResponse,
    "garage" | "spicedb" | "wersu" | "imgproxy" | "postgres"
  >,
  string
> = {
  garage: "Garage",
  spicedb: "SpiceDB",
  wersu: "WerSu",
  imgproxy: "Imgproxy",
  postgres: "Postgres",
};

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

const ServiceStatusCard: React.FC<{ status: ServiceStatus }> = ({ status }) => {
  const hasError = !status.reachable && Boolean(status.error);
  const label = status.reachable
    ? "Reachable"
    : hasError
      ? "Unreachable"
      : "Unknown";
  const colorProp: ColorChipStatus = status.reachable
    ? "success"
    : hasError
      ? "error"
      : "warning";
  // Backend reports masked credentials as URL-encoded asterisks
  // (e.g. `postgres://%2A%2A%2A:%2A%2A%2A@host:5433/db`); decode
  // for display so the address reads naturally.
  let displayAddress = status.address;
  try {
    displayAddress = decodeURIComponent(status.address);
  } catch {
    // Malformed URI sequence -- fall back to the raw address.
  }

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
        <Typography variant="subtitle1">{displayAddress}</Typography>
        <ColorChip label={label} colorProp={colorProp} size="small" />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          DNS:{" "}
          {status.dns.reachable
            ? "reachable"
            : status.dns.error || "unreachable"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Service:{" "}
          {status.service.reachable
            ? "reachable"
            : status.service.error || "unreachable"}
        </Typography>
        {status.detail && (
          <Typography variant="body2" color="text.secondary">
            Detail: {status.detail}
          </Typography>
        )}
        {status.error && !status.reachable && (
          <Alert severity="error" variant="outlined">
            {status.error}
          </Alert>
        )}
      </Stack>
    </Stack>
  );
};

export const AdministrationSection: React.FC = () => {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [restApiStatus, setRestApiStatus] = useState<ServiceStatus | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatus = async () => {
    setIsRefreshing(true);
    try {
      const data = await getStatusApi().getStatus();
      setState({ kind: "success", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load status";
      setState({ kind: "error", message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadRestApi = async () => {
    const result = await checkRestApi(BACKEND_BASE);
    setRestApiStatus(result);
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
          <Typography variant="subtitle2">REST API</Typography>
          <ServiceStatusCard status={restApiStatus} />
        </Stack>
      )}

      {state.kind === "loading" && !restApiStatus && (
        <Typography variant="body2" color="text.secondary">
          Loading status...
        </Typography>
      )}

      {state.kind === "error" && (
        <Alert severity="error" variant="outlined">
          {state.message}
        </Alert>
      )}

      {state.kind === "success" && (
        <Stack spacing={2}>
          {(Object.keys(serviceLabel) as Array<keyof typeof serviceLabel>).map(
            (key) => (
              <Stack key={key} spacing={1}>
                <Typography variant="subtitle2">{serviceLabel[key]}</Typography>
                <ServiceStatusCard status={state.data[key]} />
              </Stack>
            ),
          )}
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
