import { useEffect, useRef } from "react";
import { Logo } from "./logo";
import { useThemeStore } from "../zustand/useThemeStore";

const FAVICON_VIEWBOX = 512;
const FAVICON_LOGO_SIZE = 384;
const FAVICON_PADDING = (FAVICON_VIEWBOX - FAVICON_LOGO_SIZE) / 2;
const TILE_RADIUS = 112;
const FAVICON_PNG_SIZE = 180;

/**
 * Resolve the logo's CSS custom properties to a concrete fill colour.
 *
 * Inline SVG in the page resolves `var(--logo-*)` against the theme, but
 * an SVG loaded as an image (for the PNG raster / bookmark icon) does not
 * reliably inherit those custom properties. Baking the colour into every
 * fill keeps the raster identical to the tab icon.
 */
function inlineLogoColor(markup: string, color: string): string {
  return markup
    .replace(/var\(--logo-paper,\s*var\(--logo-secondary,[^)]*\)\)/g, color)
    .replace(/var\(--logo-dark,\s*var\(--logo-secondary,[^)]*\)\)/g, color)
    .replace(/var\(--logo-secondary,\s*[^)]*\)/g, color)
    .replace(/var\(--logo-primary,\s*[^)]*\)/g, color);
}

/** XMLSerializer adds a second xmlns to an SVG that already declares one. */
function dedupeXmlns(markup: string): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  return markup.replace(
    new RegExp(`${namespace}\\s+${namespace}`),
    namespace,
  );
}

/** Replace every icon link so tab + bookmark pick up the themed bitmap. */
function updateIconLinks(href: string, type: string): void {
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
  for (const link of links) {
    link.type = type;
    link.href = href;
    link.removeAttribute("sizes");
  }
}

/** Keep the iOS/Safari touch icon in sync as well. */
function updateTouchIcon(href: string): void {
  document
    .querySelector<HTMLLinkElement>("#app-touch-icon")
    ?.setAttribute("href", href);
}

/**
 * Keeps the browser-tab / bookmark icon in sync with the active theme.
 *
 * The favicon is a serialised copy of the same themed logo used in the
 * top bar: a primary-tinted rounded tile with the monochrome WerSu mark.
 * It has to be a data URI because an external favicon cannot inherit the
 * app's runtime theme.
 *
 * The SVG is set immediately for the tab; a PNG raster of the same SVG
 * follows because browser bookmark stores are more reliable with bitmap
 * favicons than with `image/svg+xml`.
 */
export const ThemeFavicon: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let cancelled = false;
    const serialized = dedupeXmlns(
      inlineLogoColor(
        new XMLSerializer().serializeToString(svg),
        theme.palette.primary.main,
      ),
    );
    const svgHref = `data:image/svg+xml,${encodeURIComponent(serialized)}`;

    updateIconLinks(svgHref, "image/svg+xml");

    const canvas = document.createElement("canvas");
    canvas.width = FAVICON_PNG_SIZE;
    canvas.height = FAVICON_PNG_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      context.clearRect(0, 0, FAVICON_PNG_SIZE, FAVICON_PNG_SIZE);
      context.drawImage(image, 0, 0, FAVICON_PNG_SIZE, FAVICON_PNG_SIZE);
      const pngHref = canvas.toDataURL("image/png");
      updateIconLinks(pngHref, "image/png");
      updateTouchIcon(pngHref);
    };
    image.src = svgHref;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [theme]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        width: 0,
        height: 0,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox={`0 0 ${FAVICON_VIEWBOX} ${FAVICON_VIEWBOX}`}
      >
        <rect
          width={FAVICON_VIEWBOX}
          height={FAVICON_VIEWBOX}
          rx={TILE_RADIUS}
          fill={theme.palette.background.default}
        />
        <rect
          width={FAVICON_VIEWBOX}
          height={FAVICON_VIEWBOX}
          rx={TILE_RADIUS}
          fill={theme.palette.primary.main}
          fillOpacity={theme.palette.mode === "dark" ? 0.14 : 0.09}
        />
        <Logo
          x={FAVICON_PADDING}
          y={FAVICON_PADDING}
          size={FAVICON_LOGO_SIZE}
          monochrome
          title={null}
          theme={theme}
          style={{ color: theme.palette.primary.main }}
        />
      </svg>
    </div>
  );
};

export default ThemeFavicon;
