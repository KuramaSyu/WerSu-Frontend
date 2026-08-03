import { describe, expect, it } from "vitest";
import type { CheckResult, ServiceStatus } from "./StatusApi";
import { WersuServiceInterface } from "./WersuServiceInterface";

const makeCheck = (overrides: Partial<CheckResult> = {}): CheckResult => ({
  reachable: overrides.reachable ?? true,
  latency_ms: overrides.latency_ms ?? 0,
  ...(overrides.error !== undefined ? { error: overrides.error } : {}),
  ...(overrides.address !== undefined ? { address: overrides.address } : {}),
  ...(overrides.detail !== undefined ? { detail: overrides.detail } : {}),
});

const makeStatus = (overrides: Partial<ServiceStatus> = {}): ServiceStatus => ({
  address: overrides.address ?? "tcp://example:1234",
  dns: overrides.dns ?? makeCheck({ reachable: true }),
  service: overrides.service ?? makeCheck({ reachable: true }),
  reachable: overrides.reachable ?? true,
  ...(overrides.error !== undefined ? { error: overrides.error } : {}),
  ...(overrides.detail !== undefined ? { detail: overrides.detail } : {}),
});

describe("WersuServiceInterface", () => {
  it("name() returns the label passed to the constructor", () => {
    const w = new WersuServiceInterface("Garage", makeStatus());
    expect(w.name()).toBe("Garage");
  });

  it("host() returns the raw address verbatim", () => {
    const w = new WersuServiceInterface(
      "WerSu",
      makeStatus({ address: "https://wersu.example/api" }),
    );
    expect(w.host()).toBe("https://wersu.example/api");
  });

  it("display_host() decodes URI-masked credentials", () => {
    const w = new WersuServiceInterface(
      "Postgres",
      makeStatus({ address: "postgres://%2A%2A%2A:%2A%2A%2A@host:5433/db" }),
    );
    expect(w.display_host()).toBe("postgres://***:***@host:5433/db");
  });

  it("display_host() returns the raw address when it is already decoded", () => {
    const w = new WersuServiceInterface(
      "REST API",
      makeStatus({ address: "https://wersu.example/api" }),
    );
    expect(w.display_host()).toBe("https://wersu.example/api");
  });

  it("display_host() falls back to the raw address on malformed URI sequences", () => {
    // `%E0%A4%A` is an incomplete UTF-8 escape; decodeURIComponent
    // throws URIError on it. We expect display_host() to swallow
    // the error and return the undecoded string instead.
    const w = new WersuServiceInterface(
      "Garage",
      makeStatus({ address: "tcp://example/%E0%A4%A" }),
    );
    expect(w.display_host()).toBe("tcp://example/%E0%A4%A");
  });

  it("dns_status() returns the DNS probe result", () => {
    const dns = makeCheck({ reachable: false, error: "NXDOMAIN" });
    const w = new WersuServiceInterface("Garage", makeStatus({ dns }));
    expect(w.dns_status()).toEqual(dns);
  });

  it("service_status() returns the service probe result", () => {
    const service = makeCheck({
      reachable: false,
      error: "HTTP 503",
      latency_ms: 120,
    });
    const w = new WersuServiceInterface("SpiceDB", makeStatus({ service }));
    expect(w.service_status()).toEqual(service);
  });

  it("reachable() reports the combined flag", () => {
    const down = new WersuServiceInterface(
      "Imgproxy",
      makeStatus({ reachable: false }),
    );
    expect(down.reachable()).toBe(false);
    const up = new WersuServiceInterface(
      "Imgproxy",
      makeStatus({ reachable: true }),
    );
    expect(up.reachable()).toBe(true);
  });

  it("details() returns the combined view with optional fields", () => {
    const w = new WersuServiceInterface(
      "Postgres",
      makeStatus({
        reachable: false,
        error: "connection refused",
        detail: "check pg_hba.conf",
      }),
    );
    expect(w.details()).toEqual({
      reachable: false,
      error: "connection refused",
      detail: "check pg_hba.conf",
    });
  });

  it("details() returns undefined detail/error when the backend did not report any", () => {
    const w = new WersuServiceInterface("REST API", makeStatus());
    expect(w.details().detail).toBeUndefined();
    expect(w.details().error).toBeUndefined();
    expect(w.details().reachable).toBe(true);
  });
});
