import React from "react";
import { Button, Tooltip } from "@mui/material";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";

/**
 * Clear action for the search filter.
 *
 * When the filter was applied automatically (e.g. scoped to the directory
 * the search was opened from) the button is labelled "Clear auto applied"
 * and only reverts that automatic change. Once the user edits the filter,
 * the label becomes "Clear" and it clears everything.
 */
export const SearchFilterClear: React.FC = () => {
  const isAutoApplied = useSearchFilterStore((s) => s.isAutoApplied);
  const filter = useSearchFilterStore((s) => s.filter);
  const clearFilter = useSearchFilterStore((s) => s.clearFilter);

  // Nothing selected/edited and no auto-scope: the clear action would be a
  // no-op, so don't render it at all.
  const hasSomethingToClear =
    isAutoApplied ||
    filter.mode !== "all" ||
    filter.selectedDirs.length > 0 ||
    filter.scope !== "direct";
  if (!hasSomethingToClear) return null;

  return (
    <Tooltip
      title={
        isAutoApplied ? "Clear the auto-applied filter" : "Clear all filters"
      }
      arrow
    >
      <Button
        size="small"
        variant="outlined"
        startIcon={<ClearAllIcon fontSize="small" />}
        onClick={clearFilter}
      >
        {isAutoApplied ? "Clear auto applied" : "Clear"}
      </Button>
    </Tooltip>
  );
};

export default SearchFilterClear;
