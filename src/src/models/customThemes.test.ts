// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildCustomThemesData,
  CUSTOM_THEMES_VERSION,
  customThemeContentEqual,
  parseCustomThemesData,
  removeCustomThemeGroups,
  serializeCustomThemesData,
} from "./customThemes";
import type { GeneratedThemeRecord } from "../theme/imageTheme";

const makeRecord = (
  overrides: Partial<GeneratedThemeRecord> = {},
): GeneratedThemeRecord => ({
  id: "gen-dark-1",
  groupId: "group-1",
  name: "sunset-dark",
  longName: "Sunset",
  mode: "dark",
  palette: {
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
  },
  backgroundImage: "https://example.com/bg.webp",
  blurredBackgroundImage: "",
  blur: 0,
  createdAt: 1,
  ...overrides,
});

describe("customThemeContentEqual", () => {
  it("treats two records with the same content as equal", () => {
    expect(
      customThemeContentEqual(makeRecord(), makeRecord()),
    ).toBe(true);
  });

  it("ignores background image differences (local blob vs published URL)", () => {
    const local = makeRecord({
      backgroundImage: "local:blob-1",
      blurredBackgroundImage: "local:synced-blur-abc",
    });
    const cloud = makeRecord({
      backgroundImage: "https://api.example.com/api/attachments/?key=abc",
      blurredBackgroundImage: "",
    });
    expect(customThemeContentEqual(local, cloud)).toBe(true);
  });

  it("detects a changed blur", () => {
    expect(
      customThemeContentEqual(makeRecord({ blur: 20 }), makeRecord({ blur: 50 })),
    ).toBe(false);
  });

  it("detects a changed palette color", () => {
    const other = makeRecord();
    other.palette = { ...other.palette, primary: "#ffffff" };
    expect(customThemeContentEqual(makeRecord(), other)).toBe(false);
  });

  it("detects a changed name", () => {
    expect(
      customThemeContentEqual(
        makeRecord({ longName: "Sunset" }),
        makeRecord({ longName: "Sunrise" }),
      ),
    ).toBe(false);
  });
});

describe("parseCustomThemesData", () => {
  it("parses a JSON-encoded payload and normalizes records", () => {
    const data = buildCustomThemesData([makeRecord()]);
    const str = serializeCustomThemesData(data);
    expect(typeof str).toBe("string");

    const parsed = parseCustomThemesData(str);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(CUSTOM_THEMES_VERSION);
    expect(parsed?.themes).toHaveLength(1);
    expect(parsed?.themes[0].name).toBe("sunset-dark");
    // Normalization fills fields omitted by older records.
    expect(parsed?.themes[0].blurredBackgroundImage).toBe("");
  });

  it("accepts an already-parsed object", () => {
    const parsed = parseCustomThemesData(buildCustomThemesData([makeRecord()]));
    expect(parsed?.themes).toHaveLength(1);
  });

  it("drops records that do not look like generated themes", () => {
    const parsed = parseCustomThemesData({
      version: 1,
      themes: [makeRecord(), { id: "nope" }, null, 42],
      active: null,
    });
    expect(parsed?.themes).toHaveLength(1);
  });

  it("keeps a valid active theme selection", () => {
    const parsed = parseCustomThemesData({
      version: 1,
      themes: [],
      active: { mode: "light", light: "daylight", dark: null },
    });
    expect(parsed?.active).toEqual({
      mode: "light",
      light: "daylight",
      dark: null,
    });
  });

  it("returns null for malformed payloads", () => {
    expect(parseCustomThemesData(null)).toBeNull();
    expect(parseCustomThemesData("{not json")).toBeNull();
    expect(parseCustomThemesData({ themes: [] })).toBeNull();
  });
});

describe("removeCustomThemeGroups", () => {
  it("removes every variant of a theme group", () => {
    const dark = makeRecord({ id: "gen-dark-1", groupId: "group-1" });
    const light = makeRecord({
      id: "gen-light-1",
      groupId: "group-1",
      name: "sunset-light",
      mode: "light",
    });
    const other = makeRecord({
      id: "gen-dark-2",
      groupId: "group-2",
      name: "ocean-dark",
    });
    const data = buildCustomThemesData([dark, light, other]);

    const updated = removeCustomThemeGroups(data, new Set(["group-1"]));

    expect(updated.themes).toEqual([other]);
  });

  it("clears active selections that referenced a removed theme", () => {
    const dark = makeRecord();
    const light = makeRecord({
      id: "gen-light-1",
      name: "sunset-light",
      mode: "light",
    });
    const data = buildCustomThemesData([dark, light], {
      mode: "dark",
      light: "sunset-light",
      dark: "sunset-dark",
    });

    const updated = removeCustomThemeGroups(data, new Set(["group-1"]));

    expect(updated.active).toBeNull();
  });

  it("keeps the other mode when only one active name was removed", () => {
    const dark = makeRecord();
    const light = makeRecord({
      id: "gen-light-1",
      name: "sunset-light",
      mode: "light",
    });
    const data = buildCustomThemesData([dark, light], {
      mode: "dark",
      light: "sunset-light",
      dark: "ocean-dark",
    });

    const updated = removeCustomThemeGroups(data, new Set(["group-1"]));

    expect(updated.active).toEqual({
      mode: "dark",
      light: null,
      dark: "ocean-dark",
    });
  });

  it("returns the original payload when no group matched", () => {
    const data = buildCustomThemesData([makeRecord()]);
    expect(removeCustomThemeGroups(data, new Set(["missing"]))).toBe(data);
  });
});

describe("buildCustomThemesData", () => {
  it("defaults the active selection to null", () => {
    expect(buildCustomThemesData([]).active).toBeNull();
  });
});
