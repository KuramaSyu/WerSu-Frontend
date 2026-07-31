/**
 * Tests for the pure helpers behind the top-bar reachability probe.
 * The hook itself isn't mounted here; the dedupe + modal-opening
 * logic is read from the source.
 */

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { unreachableServiceLabels } from "./serviceReachabilityModel";
import type { StatusResponse } from "../../api/StatusApi";

const fakeStatus = (
  overrides: Partial<
    Pick<
      StatusResponse,
      "garage" | "spicedb" | "wersu" | "imgproxy" | "postgres"
    >
  > & { overall_ok?: boolean },
): StatusResponse => ({
  overall_ok:
    overrides.overall_ok ??
    Object.values({
      garage: overrides.garage,
      spicedb: overrides.spicedb,
      wersu: overrides.wersu,
      imgproxy: overrides.imgproxy,
      postgres: overrides.postgres,
    }).every((s) => s === undefined || s.reachable === true),
  garage: overrides.garage ?? makeService(true),
  spicedb: overrides.spicedb ?? makeService(true),
  wersu: overrides.wersu ?? makeService(true),
  imgproxy: overrides.imgproxy ?? makeService(true),
  postgres: overrides.postgres ?? makeService(true),
  checked_at: "2026-01-01T00:00:00Z",
});

function makeService(reachable: boolean) {
  return {
    address: "http://example",
    dns: { reachable, latency_ms: 0 },
    service: { reachable, latency_ms: 0 },
    reachable,
  };
}

describe("unreachableServiceLabels()", () => {
  it("returns [] when given undefined", () => {
    expect(unreachableServiceLabels(undefined)).toEqual([]);
  });

  it("returns [] when every service is reachable", () => {
    expect(unreachableServiceLabels(fakeStatus({}))).toEqual([]);
  });

  it("lists a single unreachable service", () => {
    expect(
      unreachableServiceLabels(fakeStatus({ garage: makeService(false) })),
    ).toEqual(["Garage"]);
  });

  it("lists multiple unreachable services, in canonical order", () => {
    // Order follows SERVICE_LABEL (Garage, SpiceDB, WerSu, Imgproxy),
    // so the modal copy is stable even if `imgproxy` fails first.
    expect(
      unreachableServiceLabels(
        fakeStatus({
          wersu: makeService(false),
          imgproxy: makeService(false),
          garage: makeService(false),
        }),
      ),
    ).toEqual(["Garage", "WerSu", "Imgproxy"]);
  });

  it("ignores services that are reachable", () => {
    expect(
      unreachableServiceLabels(
        fakeStatus({
          spicedb: makeService(true),
          wersu: makeService(false),
        }),
      ),
    ).toEqual(["WerSu"]);
  });
});
