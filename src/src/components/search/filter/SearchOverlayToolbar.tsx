import React from "react";
import SearchFilter from "./SearchFilter";
import SearchLoadingBar from "./SearchLoadingBar";

interface Props {
  isInitialLoading: boolean;
  isFetchingNextPage: boolean;
}

// filter + indeterminate progress bar; lives below the header
export const SearchOverlayToolbar: React.FC<Props> = ({
  isInitialLoading,
  isFetchingNextPage,
}) => {
  return (
    <>
      <SearchFilter />
      <SearchLoadingBar
        isLoading={isInitialLoading}
        isFetchingNextPage={isFetchingNextPage}
      />
    </>
  );
};

export default SearchOverlayToolbar;
