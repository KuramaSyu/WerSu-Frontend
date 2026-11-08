import { useEffect, useState } from "react";

import { useThemeBackgroundStore } from "../../zustand/useThemeBackgroundStore";
import {
  blurImageToViewportWebp,
  type ViewportBlurImage,
} from "../../utils/imageBlur";

export interface EditorBackdropBlurImage extends Omit<ViewportBlurImage, "blob"> {
  url: string;
}

interface RenderedBackdrop extends EditorBackdropBlurImage {
  key: string;
}

/**
 * Produce a baked, viewport-sized blurred copy of the active theme
 * background for the note editor card.
 *
 * Doing the blur once in a canvas means moving the card (scroll, top-bar
 * hide/reveal, panel resize) only repaints a static image. Applying a CSS
 * `filter`/`backdrop-filter` would re-run the blur shader every frame and
 * is what makes those animations stutter on WebKit/macOS.
 */
export function useEditorBackdropBlurImage(
  enabled: boolean,
  blurPx: number,
): EditorBackdropBlurImage | null {
  const source = useThemeBackgroundStore((s) => s.resolvedUrl);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const commit = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    const schedule = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        commit();
      }, 120);
    };

    commit();
    window.addEventListener("resize", schedule);
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);

  const key =
    enabled && source !== null && blurPx > 0 && viewport.width > 0
      ? `${source}|${String(blurPx)}|${String(viewport.width)}x${String(viewport.height)}`
      : "";
  const [rendered, setRendered] = useState<RenderedBackdrop | null>(null);

  useEffect(() => {
    const url = source;
    if (key.length === 0 || url === null) {
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const blurred = await blurImageToViewportWebp(
          url,
          blurPx,
          viewport.width,
          viewport.height,
        );
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blurred.blob);
        setRendered({
          key,
          url: objectUrl,
          width: blurred.width,
          height: blurred.height,
          offsetX: blurred.offsetX,
          offsetY: blurred.offsetY,
        });
      } catch (err) {
        console.warn("[image-cache] editor backdrop blur failed:", err);
        if (!cancelled) {
          setRendered(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [key, source, blurPx, viewport.width, viewport.height]);

  return rendered !== null && rendered.key === key ? rendered : null;
}
