// @vitest-environment jsdom

import "../../test/setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The component now always mounts a ThemeProvider, so the store theme
// must be a real MUI theme rather than a partial palette stub.
vi.mock("../../zustand/useThemeStore", async () => {
  const { createTheme } = await import("@mui/material/styles");
  const { CustomThemeImpl } = await import("../../theme/customTheme");
  const theme = new CustomThemeImpl(
    createTheme({
      palette: { mode: "dark", background: { paper: "#3B4252" } },
    }),
  );
  return { useThemeStore: () => ({ theme }) };
});

import { HeaderImageBanner } from "./HeaderImageBanner";

describe("HeaderImageBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing without an image URL", () => {
    const { container } = render(<HeaderImageBanner imageUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the image", () => {
    render(
      <HeaderImageBanner
        imageUrl="https://example.com/header.png"
        alt="HeaderImage"
      />,
    );
    expect(screen.getByAltText("HeaderImage")).toHaveAttribute(
      "src",
      "https://example.com/header.png",
    );
  });

  it("renders overlaid content at the 5/13 guide line", () => {
    render(
      <HeaderImageBanner imageUrl="https://example.com/header.png">
        <span>Title</span>
      </HeaderImageBanner>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("uses the global theme", async () => {
    const { container } = render(
      <HeaderImageBanner imageUrl="https://example.com/header.png">
        <span>Title</span>
      </HeaderImageBanner>,
    );
    // The ambient app theme is dark with the default blue primary
    // (#90caf9); CustomThemeImpl picks the theme's light text for
    // contrast.
    await waitFor(() => {
      const chip = screen.getByText("Title").parentElement as HTMLElement;
      expect(getComputedStyle(chip).color).toBe("rgb(255, 255, 255)");
    });
    // The global treatment paints a theme-tinted overlay over the photo.
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("only exposes the change affordance when onChange is provided", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HeaderImageBanner imageUrl="https://example.com/header.png" />,
    );
    expect(screen.queryByLabelText("change header image")).toBeNull();

    rerender(
      <HeaderImageBanner
        imageUrl="https://example.com/header.png"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("change header image"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});