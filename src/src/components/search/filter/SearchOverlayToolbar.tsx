import React from "react";
import { Stack } from "@mui/material";
import SearchFilter from "./SearchFilter";
import SearchFilterClear from "./SearchFilterClear";
import SearchLoadingBar from "./SearchLoadingBar";
import { M3 } from "../../../statics";

interface Props {
  isInitialLoading: boolean;
  isFetchingNextPage: boolean;
}

// filter + clear action + indeterminate progress bar; lives below the header
export const SearchOverlayToolbar: React.FC<Props> = ({
  isInitialLoading,
  isFetchingNextPage,
}) => {
  return (
    <>
      <Stack
        direction="row"
        useFlexGap
        sx={{ alignItems: "center", gap: M3, flexWrap: "wrap" }}
      >
        <SearchFilter />
        <SearchFilterClear />
      </Stack>
      <SearchLoadingBar
        isLoading={isInitialLoading}
        isFetchingNextPage={isFetchingNextPage}
      />
    </>
  );
};

export default SearchOverlayToolbar;
