import { describe, expect, it } from "vitest";
import { disambiguateLabels } from "./disambiguateLabels";

interface Item {
  id: string;
  label: string;
  shelf: string;
}

const mk = (id: string, label: string, shelf = "shelf-1"): Item => ({
  id,
  label,
  shelf,
});

describe("disambiguateLabels", () => {
  it("keeps unique labels as-is", () => {
    const items: Item[] = [mk("a", "Alpha"), mk("b", "Beta")];
    const out = disambiguateLabels(
      items,
      (i) => i.label,
      (i) => i.shelf,
      (i) => i.id,
    );
    expect(out.get(items[0])).toBe("Alpha");
    expect(out.get(items[1])).toBe("Beta");
  });

  it("suffixes the parent shelf id when two items share a label", () => {
    const items: Item[] = [
      mk("a", "Permanent Notes", "shelf-1"),
      mk("b", "Permanent Notes", "shelf-2"),
    ];
    const out = disambiguateLabels(
      items,
      (i) => i.label,
      (i) => i.shelf,
      (i) => i.id,
    );
    expect(out.get(items[0])).toBe("Permanent Notes (shelf-1)");
    expect(out.get(items[1])).toBe("Permanent Notes (shelf-2)");
  });

  it("suffixes every duplicate when more than two collide", () => {
    const items: Item[] = [
      mk("x", "Fleeting", "shelf-1"),
      mk("y", "Fleeting", "shelf-2"),
      mk("z", "Fleeting", "shelf-3"),
    ];
    const out = disambiguateLabels(
      items,
      (i) => i.label,
      (i) => i.shelf,
      (i) => i.id,
    );
    expect(out.get(items[0])).toBe("Fleeting (shelf-1)");
    expect(out.get(items[1])).toBe("Fleeting (shelf-2)");
    expect(out.get(items[2])).toBe("Fleeting (shelf-3)");
  });

  it("falls through to a second paren when parent shelves also collide", () => {
    // Both directories share the label "Engineering" AND live on
    // the same shelf, so the first-pass label "(shelf-1)" still
    // collides. The second id disambiguates fully.
    const items: Item[] = [
      mk("a", "Engineering", "shelf-1"),
      mk("b", "Engineering", "shelf-1"),
    ];
    const out = disambiguateLabels(
      items,
      (i) => i.label,
      (i) => i.shelf,
      (i) => i.id,
    );
    expect(out.get(items[0])).toBe("Engineering (shelf-1) (a)");
    expect(out.get(items[1])).toBe("Engineering (shelf-1) (b)");
  });

  it("returns an empty map for an empty input", () => {
    const out = disambiguateLabels(
      [] as Item[],
      (i) => i.label,
      (i) => i.shelf,
      (i) => i.id,
    );
    expect(out.size).toBe(0);
  });
});
