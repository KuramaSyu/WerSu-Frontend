// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";
import {
  useSearchFilterStore,
  type SearchFilter,
} from "./useSearchFilterStore";

const DEFAULT_FILTER: SearchFilter = {
  selectedDirs: [],
  mode: "all",
  scope: "direct",
};

const reset = () =>
  useSearchFilterStore.setState({
    search: "",
    debouncedSearch: "",
    filter: DEFAULT_FILTER,
    isAutoApplied: false,
    filterBeforeAuto: null,
  });

describe("useSearchFilterStore auto-applied filter", () => {
  beforeEach(reset);

  it("clearFilter restores the filter from before the auto-apply", () => {
    useSearchFilterStore.setState({
      filter: { selectedDirs: ["keep"], mode: "exclude", scope: "subtree" },
    });

    useSearchFilterStore.getState().applyAutoFilter({
      mode: "include",
      selectedDirs: ["dir-1"],
      scope: "subtree",
    });

    const auto = useSearchFilterStore.getState();
    expect(auto.isAutoApplied).toBe(true);
    expect(auto.filter.selectedDirs).toEqual(["dir-1"]);

    auto.clearFilter();

    const after = useSearchFilterStore.getState();
    expect(after.filter).toEqual({
      selectedDirs: ["keep"],
      mode: "exclude",
      scope: "subtree",
    });
    expect(after.isAutoApplied).toBe(false);
    expect(after.filterBeforeAuto).toBeNull();
  });

  it("a user edit supersedes the auto filter, so clear resets everything", () => {
    useSearchFilterStore.getState().applyAutoFilter({
      mode: "include",
      selectedDirs: ["dir-1"],
      scope: "subtree",
    });

    useSearchFilterStore.getState().setFilterMode("exclude");

    const edited = useSearchFilterStore.getState();
    expect(edited.isAutoApplied).toBe(false);
    expect(edited.filterBeforeAuto).toBeNull();

    edited.clearFilter();

    expect(useSearchFilterStore.getState().filter).toEqual(DEFAULT_FILTER);
  });

  it("clearFilter without an auto apply resets to defaults", () => {
    useSearchFilterStore.getState().setSelectedDirs(["dir-1"]);
    useSearchFilterStore.getState().clearFilter();
    expect(useSearchFilterStore.getState().filter).toEqual(DEFAULT_FILTER);
  });

  it("a second auto apply keeps the original restore point", () => {
    useSearchFilterStore.getState().applyAutoFilter({
      mode: "include",
      selectedDirs: ["dir-1"],
      scope: "subtree",
    });
    useSearchFilterStore.getState().applyAutoFilter({
      mode: "include",
      selectedDirs: ["dir-2"],
      scope: "subtree",
    });

    useSearchFilterStore.getState().clearFilter();

    expect(useSearchFilterStore.getState().filter).toEqual(DEFAULT_FILTER);
  });
});
