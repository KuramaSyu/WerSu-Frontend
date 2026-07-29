import type { StatusResponse } from "../../api/StatusApi";

const SERVICE_LABEL: Record<
  keyof Pick<StatusResponse, "garage" | "spicedb" | "wersu" | "imgproxy">,
  string
> = {
  garage: "Garage",
  spicedb: "SpiceDB",
  wersu: "WerSu",
  imgproxy: "Imgproxy",
};

/** Service labels that are reachable=false in the given status. */
export function unreachableServiceLabels(
  status: StatusResponse | undefined,
): string[] {
  if (!status) return [];
  return (Object.keys(SERVICE_LABEL) as Array<keyof typeof SERVICE_LABEL>)
    .filter((key) => status[key].reachable === false)
    .map((key) => SERVICE_LABEL[key]);
}
