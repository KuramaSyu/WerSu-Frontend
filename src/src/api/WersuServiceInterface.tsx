import type { CheckResult, ServiceStatus } from "./StatusApi";

/**
 * Combined view of the human-readable fields on a single service
 * row. Callers that only care about "is it up, and what does the
 * backend want me to tell the user" should read this instead of
 * poking the raw :class:`ServiceStatus`.
 */
export interface WersuServiceDetails {
  /** True iff both DNS and service probes succeeded. */
  reachable: boolean;
  /** Free-form detail text from the backend (may be undefined). */
  detail?: string;
  /** Error text from the backend (may be undefined). */
  error?: string;
}

/**
 * Typed view over one :class:`ServiceStatus` row.
 *
 * The reachability probe (`useServiceReachability`) and the
 * Settings admin panel both want the same per-service surface:
 * a human-friendly label, the raw address, the two probe results,
 * and the summary fields. Wrapping the row in this class keeps
 * the label map and the accessors in one place instead of
 * scattering them across the call sites.
 *
 * Args:
 *     label: human-friendly display name (e.g. `"Garage"`,
 *         `"REST API"`).
 *     status: the raw :class:`ServiceStatus` row to wrap. The
 *         wrapper holds the reference as-is; no defensive copies.
 */
export class WersuServiceInterface {
  private readonly status: ServiceStatus;
  private readonly label: string;

  constructor(label: string, status: ServiceStatus) {
    this.label = label;
    this.status = status;
  }

  /** Human-friendly display name (e.g. `"Garage"`). */
  name(): string {
    return this.label;
  }

  /** Raw address the backend probed (URL, host:port, or connection string). */
  host(): string {
    return this.status.address;
  }

  /**
   * User-facing variant of :meth:`host` with masked credentials
   * decoded.
   *
   * Backend statuses report masked secrets as URL-encoded
   * asterisks (e.g. `postgres://%2A%2A%2A:%2A%2A%2A@host:5433/db`).
   * Decoding produces `postgres://***:***@host:5433/db` which
   * reads naturally in the admin panel. A malformed URI sequence
   * falls back to the raw address so the row still renders.
   */
  display_host(): string {
    try {
      return decodeURIComponent(this.status.address);
    } catch {
      return this.status.address;
    }
  }

  /** DNS-resolution probe result. */
  dns_status(): CheckResult {
    return this.status.dns;
  }

  /** Service-level probe result (e.g. HTTP `GET /api/status`). */
  service_status(): CheckResult {
    return this.status.service;
  }

  /** True iff both DNS and service probes succeeded. */
  reachable(): boolean {
    return this.status.reachable;
  }

  /** Combined view of the detail / error / reachability fields. */
  details(): WersuServiceDetails {
    return {
      reachable: this.status.reachable,
      detail: this.status.detail,
      error: this.status.error,
    };
  }
}
