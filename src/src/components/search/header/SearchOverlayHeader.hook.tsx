import { useEffect } from "react";
import {
  useSearchFilterStore,
  SEARCH_DEBOUNCE_DELAY_MS,
} from "../../../zustand/useSearchFilterStore";

// mirror raw `search` into `debouncedSearch` after the configured delay
export const useDebouncedSearchSync = (search: string): void => {
  const setDebouncedSearch = useSearchFilterStore((s) => s.setDebouncedSearch);
  useEffect(() => {
    if (search === "") {
      setDebouncedSearch(search);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [search, setDebouncedSearch]);
};
