// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../test/setup";
import { ThemeColorCircles } from "./ThemeColorCircles";
import { useThemeStore } from "../zustand/useThemeStore";

// Stub the broken dynamic-color import path that customTheme.ts
// transitively pulls in via material-color-utilities.
vi.mock("@material/material-color-utilities", () => ({
  themeFromSourceColor: () => ({}),
  argbFromHex: () => 0,
  hexFromArgb: () => "#000000",
}));

// Stub Vibrant: themeManager imports it eagerly via useThemeStore.
vi.mock("node-vibrant/browser", () => ({
  Vibrant: {
    from: () => ({
      getPalette: () => Promise.resolve({}),
    }),
  },
}));

function resetStores() {
  useThemeStore.setState({
    theme: {
      ...createTheme({
        palette: {
          mode: "dark",
          primary: { main: "#111111" },
          secondary: { main: "#222222" },
          background: { default: "#333333", paper: "#444444" },
        },
      }),
      custom: {
        backgroundImages: [],
        themeName: "test",
        longName: "Test",
        chosenBackgroundImage: undefined,
      },
    },
  });
}

beforeEach(() => {
  resetStores();
});
afterEach(() => {
  resetStores();
});

describe("ThemeColorCircles", () => {
  it("renders four circles with the active theme colors", () => {
    render(
      <ThemeProvider theme={useThemeStore.getState().theme}>
        <ThemeColorCircles circleSize={40} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-circle-primary")).toHaveStyle({
      backgroundColor: "rgb(17, 17, 17)",
    });
    expect(screen.getByTestId("theme-circle-secondary")).toHaveStyle({
      backgroundColor: "rgb(34, 34, 34)",
    });
    expect(screen.getByTestId("theme-circle-default")).toHaveStyle({
      backgroundColor: "rgb(51, 51, 51)",
    });
    expect(screen.getByTestId("theme-circle-paper")).toHaveStyle({
      backgroundColor: "rgb(68, 68, 68)",
    });
  });

  it("lays the circles in a single row, overlapping by half", () => {
    render(
      <ThemeProvider theme={useThemeStore.getState().theme}>
        <ThemeColorCircles circleSize={40} />
      </ThemeProvider>,
    );
    // 40 + 3 * 20 = 100
    expect(screen.getByTestId("theme-color-circles")).toHaveStyle({
      width: "100px",
      height: "40px",
    });
    expect(screen.getByTestId("theme-circle-primary")).toHaveStyle({
      left: "0px",
      width: "40px",
      height: "40px",
      borderRadius: "50%",
    });
    // Each subsequent circle shifts left by 50% of the diameter.
    expect(screen.getByTestId("theme-circle-secondary")).toHaveStyle({
      left: "20px",
    });
    expect(screen.getByTestId("theme-circle-paper")).toHaveStyle({
      left: "40px",
    });
    expect(screen.getByTestId("theme-circle-default")).toHaveStyle({
      left: "60px",
    });
  });

  it("renders an img role with the default aria-label", () => {
    render(
      <ThemeProvider theme={useThemeStore.getState().theme}>
        <ThemeColorCircles />
      </ThemeProvider>,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "Theme color preview");
  });

  it("honours an explicit palette override", () => {
    render(
      <ThemeProvider theme={useThemeStore.getState().theme}>
        <ThemeColorCircles
          palette={{ primary: "#abcdef", secondary: "#fedcba" }}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-circle-primary")).toHaveStyle({
      backgroundColor: "rgb(171, 205, 239)",
    });
    expect(screen.getByTestId("theme-circle-secondary")).toHaveStyle({
      backgroundColor: "rgb(254, 220, 186)",
    });
    // Untouched colors still come from the active theme.
    expect(screen.getByTestId("theme-circle-paper")).toHaveStyle({
      backgroundColor: "rgb(68, 68, 68)",
    });
  });

  it("previews a non-active theme when one is supplied", () => {
    const other = createTheme({
      palette: {
        primary: { main: "#abcdef" },
        secondary: { main: "#fedcba" },
        background: { default: "#0a0a0a", paper: "#050505" },
      },
    });
    render(
      <ThemeProvider theme={useThemeStore.getState().theme}>
        <ThemeColorCircles theme={other} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-circle-primary")).toHaveStyle({
      backgroundColor: "rgb(171, 205, 239)",
    });
    expect(screen.getByTestId("theme-circle-default")).toHaveStyle({
      backgroundColor: "rgb(10, 10, 10)",
    });
  });
});
