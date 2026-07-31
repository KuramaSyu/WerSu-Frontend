import { BACKEND_BASE } from "../statics";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export interface CheckResult {
  reachable: boolean;
  error?: string;
  address?: string;
  latency_ms: number;
  detail?: string;
}

export interface ServiceStatus {
  address: string;
  dns: CheckResult;
  service: CheckResult;
  reachable: boolean;
  detail?: string;
  error?: string;
}

export interface StatusResponse {
  overall_ok: boolean;
  garage: ServiceStatus;
  spicedb: ServiceStatus;
  wersu: ServiceStatus;
  imgproxy: ServiceStatus;
  checked_at: string;
}

export interface IStatusApi {
  getStatus(): Promise<StatusResponse>;
}

export class StatusApi implements IStatusApi {
  async getStatus(): Promise<StatusResponse> {
    const response = await fetch(`${BACKEND_BASE}/api/status`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to load status (${response.status})`);
    }

    return (await response.json()) as StatusResponse;
  }
}

const statusApiSingleton = new StatusApi();
apiRegistry.register(statusApiSingleton);
export const STATUS_API_TOKEN: ApiToken<StatusApi> = Symbol(
  "StatusApi",
) as ApiToken<StatusApi>;
apiRegistry.register(statusApiSingleton, STATUS_API_TOKEN);

export function getStatusApi(): StatusApi {
  return apiRegistry.get<StatusApi>(STATUS_API_TOKEN);
}

/**
 * Probe the REST API URL itself from the browser's perspective.
 *
 * Unlike `getStatus()` (which returns what the backend reports about
 * its own dependencies), this returns the frontend's view of the
 * backend's reachability. The DNS check uses a `HEAD` request with
 * `mode: "no-cors"` so CORS-misconfigured backends still appear
 * reachable at the DNS layer; the throw is what tells us the host
 * didn't resolve or refused the TCP connection. The service check
 * is the same `/api/status` GET the rest of the app uses, with a
 * non-OK response treated as a service failure.
 *
 * Args:
 *     url: base URL the frontend uses to talk to the backend
 *         (e.g. `BACKEND_BASE`).
 *
 * Returns:
 *     A :class:`ServiceStatus`-shaped object so the existing
 *     `ServiceStatusCard` can render it without a separate path.
 */
export async function checkRestApi(url: string): Promise<ServiceStatus> {
  const failedResult = (error: string): ServiceStatus => ({
    address: url,
    dns: { reachable: false, error, latency_ms: 0 },
    service: { reachable: false, error, latency_ms: 0 },
    reachable: false,
    error,
  });

  if (!url) {
    return failedResult("REST API URL is not configured");
  }

  // DNS check: HEAD with `mode: "no-cors"` so we still succeed when
  // the backend doesn't return CORS headers. The throw is what tells
  // us the host didn't resolve or the TCP connection was refused.
  const dnsStart =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  let dnsResult: CheckResult;
  try {
    await fetch(url, { method: "HEAD", mode: "no-cors" });
    dnsResult = {
      reachable: true,
      latency_ms: Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          dnsStart,
      ),
    };
  } catch (error) {
    dnsResult = {
      reachable: false,
      error: error instanceof Error ? error.message : "DNS lookup failed",
      latency_ms: Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          dnsStart,
      ),
    };
  }

  // Service check: GET /api/status with the same wire shape the rest
  // of the app uses, including session cookies. A non-OK response is
  // a service failure even if DNS was fine.
  const serviceStart =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  let serviceResult: CheckResult;
  try {
    const response = await fetch(`${url}/api/status`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    serviceResult = {
      reachable: true,
      latency_ms: Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          serviceStart,
      ),
    };
  } catch (error) {
    serviceResult = {
      reachable: false,
      error: error instanceof Error ? error.message : "Service unreachable",
      latency_ms: Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          serviceStart,
      ),
    };
  }

  const reachable = dnsResult.reachable && serviceResult.reachable;
  return {
    address: url,
    dns: dnsResult,
    service: serviceResult,
    reachable,
    error: reachable
      ? undefined
      : !dnsResult.reachable
        ? dnsResult.error
        : serviceResult.error,
  };
}
