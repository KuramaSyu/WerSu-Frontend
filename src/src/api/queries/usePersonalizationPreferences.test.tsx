// Tier-1 tests for the rail personalization preference hooks.
//
// Contract we care about:
//   - Reads and writes target the existing keyed row
//     (`scope: "user"`, `key: "personalization"`) rather than a new one.
//   - The payload is (de)serialized as the JSON-encoded string the API
//     transports in `preferences_json`.
//   - Absent/foreign payloads parse to `null` instead of throwing.
//   - Saving merges (PATCH) so other keys in the row survive.

// @vitest-environment jsdom

import "../../test/setup";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { preferencesApi } = vi.hoisted(() => ({
  preferencesApi: {
    getPreferences: vi.fn(),
    mergePreferences: vi.fn(),
    replacePreferences: vi.fn(),
    deletePreferences: vi.fn(),
  },
}));

vi.mock("../PreferencesApi", () => ({
  getPreferencesApi: () => preferencesApi,
}));

import {
  usePersonalizationPreferences,
  useSavePersonalizationPreferences,
} from "./preferencesQueries";
import {
  defaultPersonalizationData,
  PERSONALIZATION_PREFERENCE_KEY,
  serializePersonalizationData,
} from "../../models/personalization";

const payload = {
  ...defaultPersonalizationData(),
  frequentlyUsedDays: 7,
  frequentlyUsedRailLimit: 12,
};

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  preferencesApi.getPreferences.mockReset().mockResolvedValue({
    scope: "user",
    target_id: "user-1",
    key: PERSONALIZATION_PREFERENCE_KEY,
    preferences_json: serializePersonalizationData(payload),
  });
  preferencesApi.mergePreferences.mockReset().mockResolvedValue({
    scope: "user",
    target_id: "user-1",
    key: PERSONALIZATION_PREFERENCE_KEY,
    preferences_json: serializePersonalizationData(payload),
  });
});

describe("usePersonalizationPreferences", () => {
  it("reads the existing keyed personalization row", async () => {
    const { result } = renderHook(
      () => usePersonalizationPreferences({ userId: "user-1" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(preferencesApi.getPreferences).toHaveBeenCalledWith({
      scope: "user",
      target_id: "user-1",
      key: PERSONALIZATION_PREFERENCE_KEY,
    });
    expect(result.current.data).toEqual(payload);
  });

  it("stays disabled until a user id is known", () => {
    renderHook(() => usePersonalizationPreferences({ userId: null }), {
      wrapper,
    });
    expect(preferencesApi.getPreferences).not.toHaveBeenCalled();
  });

  it("falls back to null for an empty or foreign payload", async () => {
    preferencesApi.getPreferences.mockResolvedValue({
      scope: "user",
      target_id: "user-1",
      key: PERSONALIZATION_PREFERENCE_KEY,
      preferences_json: "{}",
    });

    const { result } = renderHook(
      () => usePersonalizationPreferences({ userId: "user-1" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});

describe("useSavePersonalizationPreferences", () => {
  it("merges the encoded payload into the same keyed row", async () => {
    const { result } = renderHook(() => useSavePersonalizationPreferences(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: "user-1", data: payload });
    });

    expect(preferencesApi.mergePreferences).toHaveBeenCalledTimes(1);
    const request = preferencesApi.mergePreferences.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      scope: "user",
      target_id: "user-1",
      key: PERSONALIZATION_PREFERENCE_KEY,
    });
    expect(JSON.parse(request.preferences_json)).toEqual(payload);
    expect(preferencesApi.replacePreferences).not.toHaveBeenCalled();
  });
});
