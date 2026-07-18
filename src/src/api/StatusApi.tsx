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
