import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useOutlineStore } from "../zustand/outlineStore";

/**
 * Honour the `/n/:id?section=<slug>` deep-link: scroll the matching
 * heading into view once the outline has populated. Strips the param
 * if the slug no longer matches any heading (stale link after edits).
 * Mirrors the `?cat=` pattern on the Settings page.
 */
export const useScrollToSectionOnLoad = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const items = useOutlineStore((s) => s.items);

  useEffect(() => {
    if (!sectionParam) return;
    if (items.length === 0) return; // editor hasn't populated yet
    const match = items.find((item) => item.id === sectionParam);
    if (!match) {
      const next = new URLSearchParams(searchParams);
      next.delete("section");
      setSearchParams(next, { replace: true });
      return;
    }
    // One frame: let layout settle so scrollIntoView measures final position.
    const raf = window.requestAnimationFrame(() => {
      document
        .getElementById(match.id)
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [sectionParam, items, searchParams, setSearchParams]);
};
