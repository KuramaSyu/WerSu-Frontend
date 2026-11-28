import { ROOT_SENTINEL_ID } from "../../../zustand/useSearchFilterStore";

export const dirLabel = (
  id: string,
  byId: Record<string, { display_name?: string; name?: string }>,
): string =>
  id === ROOT_SENTINEL_ID
    ? "root"
    : byId[id]?.display_name || byId[id]?.name || id;

// One selection shows its name; several show the first name plus
// a count so the filter chip stays small.
export const directoryChipLabel = (
  selectedDirs: string[],
  byId: Record<string, { display_name?: string; name?: string }>,
): string => {
  if (selectedDirs.length === 0) return "All folders";
  const first = dirLabel(selectedDirs[0], byId);
  return selectedDirs.length === 1
    ? first
    : `${first} +${selectedDirs.length - 1}`;
};
