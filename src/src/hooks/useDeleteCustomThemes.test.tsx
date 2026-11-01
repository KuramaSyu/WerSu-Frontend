// Tests for deleting synced custom themes.
//
// Publishing a custom theme writes it to the owner's `custom-themes`
// preference row. Hiding it locally (as `deleteThemeLocally` does) is not
// enough: the next sync would bring it back on this and every other client.
// `useDeleteCustomThemes` must rewrite each owning cloud row so the deletion
// propagates, and only then drop the device-local copy.

// @vitest-environment jsdom

import "../test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPreferencesApi } from "../api/PreferencesApi";
import {
  CUSTOM_THEMES_PREFERENCE_KEY,
  parseCustomThemesData,
  serializeCustomThemesData,
} from "../models/customThemes";
import type { ThemePreference } from "../models/Preferences";
import type { GeneratedThemeRecord } from "../theme/imageTheme";
import { useThemeStore } from "../zustand/useThemeStore";
import { useDeleteCustomThemes } from "./useCustomThemes";

const PALETTE = {
  primary: "#112233",
  primaryLight: "#223344",
  primaryDark: "#001122",
  secondary: "#334455",
  secondaryLight: "#445566",
  secondaryDark: "#223344",
  vibrant: "#556677",
  muted: "#667788",
  mutedLight: "#778899",
  mutedDark: "#556677",
  backgroundDefault: "#0b0b0b",
  backgroundPaper: "#141414",
  panel: "#101010",
  textPrimary: "#f5f5f5",
  textSecondary: "#cccccc",
};

const record = (
  overrides: Partial<GeneratedThemeRecord> = {},
): GeneratedThemeRecord => ({
  id: "gen-dark-1",
  groupId: "grp-1",
  name: "sunset-dark",
  longName: "Sunset",
  mode: "dark",
  palette: PALETTE,
  backgroundImage: "https://example.com/bg.webp",
  blurredBackgroundImage: "",
  blur: 0,
  createdAt: 1,
  ...overrides,
});

const cloudPayload = (
  themes: GeneratedThemeRecord[],
  active: ThemePreference | null = null,
) =>
  serializeCustomThemesData({
    version: 1,
    themes,
    active,
  });

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  useThemeStore.setState({
    generatedThemes: [],
    syncedThemes: [],
    syncedThemeIdsBySource: {},
  });
});

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

describe("useDeleteCustomThemes", () => {
  it("removes a synced theme from its cloud row and the local store", async () => {
    const api = getPreferencesApi();
    const dark = record();
    const light = record({
      id: "gen-light-1",
      name: "sunset-light",
      mode: "light",
    });
    const other = record({
      id: "gen-dark-2",
      groupId: "grp-2",
      name: "ocean-dark",
      longName: "Ocean",
    });
    useThemeStore
      .getState()
      .registerSyncedThemes("user:user-1", [dark, light, other]);

    vi.spyOn(api, "getPreferences").mockResolvedValue({
      scope: "user",
      target_id: "user-1",
      key: CUSTOM_THEMES_PREFERENCE_KEY,
      preferences_json: cloudPayload([dark, light, other], {
        mode: "dark",
        light: "sunset-light",
        dark: "sunset-dark",
      }),
    });
    const replace = vi
      .spyOn(api, "replacePreferences")
      .mockImplementation(async (request) => ({
        scope: request.scope,
        target_id: request.target_id,
        key: request.key,
        preferences_json: request.preferences_json,
      }));

    const { result } = renderHook(() => useDeleteCustomThemes(), { wrapper });

    await act(async () => {
      await result.current.deleteThemes([dark]);
    });

    expect(api.getPreferences).toHaveBeenCalledWith({
      scope: "user",
      target_id: "user-1",
      key: CUSTOM_THEMES_PREFERENCE_KEY,
    });
    expect(replace).toHaveBeenCalledTimes(1);
    const body = replace.mock.calls[0]![0];
    expect(body.scope).toBe("user");
    expect(body.target_id).toBe("user-1");
    expect(body.key).toBe(CUSTOM_THEMES_PREFERENCE_KEY);

    const written = parseCustomThemesData(body.preferences_json);
    expect(written?.themes.map((r) => r.id)).toEqual(["gen-dark-2"]);
    // The active selection pointed at the deleted pair, so it is cleared.
    expect(written?.active).toBeNull();

    expect(
      useThemeStore.getState().syncedThemes.some((r) => r.id === dark.id),
    ).toBe(false);
  });

  it("rewrites a shelf row for a locally generated published theme", async () => {
    const api = getPreferencesApi();
    const dark = record({ scope: "shelf", targetId: "shelf-9" });
    useThemeStore.setState({ generatedThemes: [dark] });

    vi.spyOn(api, "getPreferences").mockResolvedValue({
      scope: "shelf",
      target_id: "shelf-9",
      key: CUSTOM_THEMES_PREFERENCE_KEY,
      preferences_json: cloudPayload([dark]),
    });
    const replace = vi
      .spyOn(api, "replacePreferences")
      .mockImplementation(async (request) => ({
        scope: request.scope,
        target_id: request.target_id,
        key: request.key,
        preferences_json: request.preferences_json,
      }));

    const { result } = renderHook(() => useDeleteCustomThemes(), { wrapper });

    await act(async () => {
      await result.current.deleteThemes([dark]);
    });

    expect(api.getPreferences).toHaveBeenCalledWith({
      scope: "shelf",
      target_id: "shelf-9",
      key: CUSTOM_THEMES_PREFERENCE_KEY,
    });
    const written = parseCustomThemesData(
      replace.mock.calls[0]![0].preferences_json,
    );
    expect(written?.themes).toEqual([]);
    expect(useThemeStore.getState().generatedThemes).toEqual([]);
  });

  it("skips the cloud write when the row does not contain the theme", async () => {
    const api = getPreferencesApi();
    const dark = record({ scope: "user", targetId: "user-1" });
    useThemeStore.setState({ generatedThemes: [dark] });

    vi.spyOn(api, "getPreferences").mockResolvedValue({
      scope: "user",
      target_id: "user-1",
      key: CUSTOM_THEMES_PREFERENCE_KEY,
      preferences_json: cloudPayload([]),
    });
    const replace = vi.spyOn(api, "replacePreferences");

    const { result } = renderHook(() => useDeleteCustomThemes(), { wrapper });

    await act(async () => {
      await result.current.deleteThemes([dark]);
    });

    expect(replace).not.toHaveBeenCalled();
    expect(useThemeStore.getState().generatedThemes).toEqual([]);
  });

  it("keeps the theme when the cloud write fails", async () => {
    const api = getPreferencesApi();
    const dark = record({ scope: "user", targetId: "user-1" });
    useThemeStore.setState({ generatedThemes: [dark] });

    vi.spyOn(api, "getPreferences").mockResolvedValue({
      scope: "user",
      target_id: "user-1",
      key: CUSTOM_THEMES_PREFERENCE_KEY,
      preferences_json: cloudPayload([dark]),
    });
    vi.spyOn(api, "replacePreferences").mockRejectedValue(
      new Error("network down"),
    );

    const { result } = renderHook(() => useDeleteCustomThemes(), { wrapper });

    await act(async () => {
      await expect(result.current.deleteThemes([dark])).rejects.toThrow(
        "network down",
      );
    });

    // The cloud still lists it, so the local copy stays for a retry.
    expect(useThemeStore.getState().generatedThemes).toEqual([dark]);
  });
});
