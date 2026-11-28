import { describe, expect, it } from "vitest";

import { ROOT_SENTINEL_ID } from "../../../zustand/useSearchFilterStore";
import { directoryChipLabel, dirLabel } from "./filterLabels";

describe("directoryChipLabel", () => {
  const byId = {
    a: { display_name: "Katzen" },
    b: { name: "Hunde" },
  };

  it("uses the dimension label when nothing is selected", () => {
    expect(directoryChipLabel([], byId)).toBe("All folders");
  });

  it("shows the selected folder name for a single selection", () => {
    expect(directoryChipLabel(["a"], byId)).toBe("Katzen");
  });

  it("keeps multiple selections small", () => {
    expect(directoryChipLabel(["a", "b", "c"], byId)).toBe("Katzen +2");
  });

  it("falls back to the id while directories load", () => {
    expect(directoryChipLabel(["unknown"], {})).toBe("unknown");
  });

  it("labels the root sentinel", () => {
    expect(dirLabel(ROOT_SENTINEL_ID, byId)).toBe("root");
  });
});
