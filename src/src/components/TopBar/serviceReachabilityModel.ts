import type { StatusResponse } from "../../api/StatusApi";
import { WersuServiceInterface } from "../../api/WersuServiceInterface";

/**
 * Human-friendly labels for every backend service that
 * `/api/status` reports on. Kept here so both the reachability
 * probe and the Settings admin panel render the same names.
 */
export const SERVICE_LABEL: Record<
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

/** Service keys in the canonical order the backend reports them. */
export const SERVICE_KEYS = Object.keys(SERVICE_LABEL) as Array<
  keyof typeof SERVICE_LABEL
>;

/**
 * Wrap every service in the given status response as a
 * :class:`WersuServiceInterface`. Returns an empty array when
 * the response is undefined so callers can chain `.filter`/
 * `.map` without null-guarding.
 */
export function servicesFromStatus(
  status: StatusResponse | undefined,
): WersuServiceInterface[] {
  if (!status) return [];
  return SERVICE_KEYS.map(
    (key) => new WersuServiceInterface(SERVICE_LABEL[key], status[key]),
  );
}

/** Names of services whose `reachable()` flag is `false`. */
export function unreachableServiceLabels(
  status: StatusResponse | undefined,
): string[] {
  return servicesFromStatus(status)
    .filter((service) => !service.reachable())
    .map((service) => service.name());
}
