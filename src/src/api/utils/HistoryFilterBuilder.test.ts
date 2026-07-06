// Unit tests for HistoryFilterBuilder. The wire layer is tested
// in HistoryApi.test.ts; here we exercise the fluent setter
// semantics and the build()-time validation rules.

import { describe, expect, it } from "vitest";
import { HistoryFilterBuilder } from "./HistoryFilterBuilder";

describe("HistoryFilterBuilder - mode setters", () => {
  it("useHistory sets mode to 'history'", () => {
    const f = new HistoryFilterBuilder().useHistory().build();
    expect(f.mode).toBe("history");
  });

  it("showMostUsed sets mode to 'most_used'", () => {
    const f = new HistoryFilterBuilder().showMostUsed().build();
    expect(f.mode).toBe("most_used");
  });

  it("build() throws when no mode was set", () => {
    const builder = new HistoryFilterBuilder().setNote("n-1");
    expect(() => builder.build()).toThrow(/useHistory|showMostUsed/);
  });
});

describe("HistoryFilterBuilder - most_used-only rules", () => {
  it("withAlgorithm outside most_used throws on build()", () => {
    const builder = new HistoryFilterBuilder()
      .useHistory()
      .withAlgorithm("MOST_USED_ALGORITHM_COUNT");
    expect(() => builder.build()).toThrow(
      /withAlgorithm.*requires showMostUsed/,
    );
  });

  it("withAlgorithm inside most_used is allowed", () => {
    const f = new HistoryFilterBuilder()
      .showMostUsed()
      .withAlgorithm("MOST_USED_ALGORITHM_LOG_COUNT")
      .build();
    expect(f.algorithm).toBe("MOST_USED_ALGORITHM_LOG_COUNT");
  });

  it("uniquePerDay() outside most_used throws on build()", () => {
    const builder = new HistoryFilterBuilder().useHistory().uniquePerDay();
    expect(() => builder.build()).toThrow(
      /uniquePerDay.*requires showMostUsed/,
    );
  });

  it("uniquePerDay(false) outside most_used still throws", () => {
    // Even an explicit false is a signal that the caller wanted
    // it for `most_used`; the validation runs before the value
    // matters.
    const builder = new HistoryFilterBuilder().useHistory().uniquePerDay(false);
    expect(() => builder.build()).toThrow(
      /uniquePerDay.*requires showMostUsed/,
    );
  });

  it("uniquePerDay(true) inside most_used is allowed", () => {
    const f = new HistoryFilterBuilder().showMostUsed().uniquePerDay().build();
    expect(f.unique_per_day).toBe(true);
  });
});

describe("HistoryFilterBuilder - days validation", () => {
  it("accepts a positive integer", () => {
    const f = new HistoryFilterBuilder().useHistory().setDays(30).build();
    expect(f.days).toBe(30);
  });

  it("rejects zero", () => {
    const builder = new HistoryFilterBuilder().useHistory().setDays(0);
    expect(() => builder.build()).toThrow(/days must be a positive/);
  });

  it("rejects negative integers", () => {
    const builder = new HistoryFilterBuilder().useHistory().setDays(-3);
    expect(() => builder.build()).toThrow(/days must be a positive/);
  });

  it("rejects non-integers", () => {
    const builder = new HistoryFilterBuilder().useHistory().setDays(1.5);
    expect(() => builder.build()).toThrow(/days must be a positive/);
  });
});

describe("HistoryFilterBuilder - actions", () => {
  it("setAction produces a one-element actions array", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setAction("note_viewed")
      .build();
    expect(f.actions).toEqual(["note_viewed"]);
  });

  it("setAction replaces prior actions", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setAction("note_viewed")
      .setAction("note_edited")
      .build();
    expect(f.actions).toEqual(["note_edited"]);
  });

  it("setActionSet spreads all arguments onto the wire array", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setActionSet("note_viewed", "note_created", "note_deleted")
      .build();
    expect(f.actions).toEqual(["note_viewed", "note_created", "note_deleted"]);
  });

  it("setActionSet with zero arguments clears the array", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setAction("note_viewed")
      .setActionSet()
      .build();
    expect(f.actions).toEqual([]);
  });
});

describe("HistoryFilterBuilder - setAccessedAs", () => {
  it("defaults to ACCESSED_AS_USER when called with no argument", () => {
    const f = new HistoryFilterBuilder().useHistory().setAccessedAs().build();
    expect(f.accessed_as).toBe("ACCESSED_AS_USER");
  });

  it("accepts an explicit value", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setAccessedAs("ACCESSED_AS_SYSTEM")
      .build();
    expect(f.accessed_as).toBe("ACCESSED_AS_SYSTEM");
  });
});

describe("HistoryFilterBuilder - scalar setters", () => {
  it("setNote replaces prior note id", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setNote("n-1")
      .setNote("n-2")
      .build();
    expect(f.note_id).toBe("n-2");
  });

  it("setDirectory replaces prior directory id (matches wire)", () => {
    // The wire currently accepts a single directory_id; calling
    // setDirectory twice is a replace, not an append. If the
    // backend ever supports multiple, the builder should be
    // updated alongside it.
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setDirectory("d-1")
      .setDirectory("d-2")
      .build();
    expect(f.directory_id).toBe("d-2");
  });

  it("setUser maps to actor_id", () => {
    const f = new HistoryFilterBuilder().useHistory().setUser("u-1").build();
    expect(f.actor_id).toBe("u-1");
  });

  it("setRoleId maps to role_id", () => {
    const f = new HistoryFilterBuilder().useHistory().setRoleId("r-1").build();
    expect(f.role_id).toBe("r-1");
  });

  it("setLimit / setOffset propagate as numbers", () => {
    const f = new HistoryFilterBuilder()
      .useHistory()
      .setLimit(50)
      .setOffset(100)
      .build();
    expect(f.limit).toBe(50);
    expect(f.offset).toBe(100);
  });
});

describe("HistoryFilterBuilder - chaining", () => {
  it("every setter returns `this` so calls can be chained", () => {
    const builder = new HistoryFilterBuilder();
    expect(builder.useHistory()).toBe(builder);
    expect(builder.showMostUsed()).toBe(builder);
    expect(builder.setNote("n-1")).toBe(builder);
    expect(builder.setDirectory("d-1")).toBe(builder);
    expect(builder.setUser("u-1")).toBe(builder);
    expect(builder.setAccessedAs("ACCESSED_AS_USER")).toBe(builder);
    expect(builder.setRoleId("r-1")).toBe(builder);
    expect(builder.setAction("note_viewed")).toBe(builder);
    expect(builder.setActionSet("note_viewed")).toBe(builder);
    expect(builder.setDays(7)).toBe(builder);
    expect(builder.setLimit(10)).toBe(builder);
    expect(builder.setOffset(0)).toBe(builder);
    expect(builder.withAlgorithm("MOST_USED_ALGORITHM_COUNT")).toBe(builder);
    expect(builder.uniquePerDay()).toBe(builder);
  });

  it("supports the documented most-used + log_count + unique_per_day combo", () => {
    const f = new HistoryFilterBuilder()
      .showMostUsed()
      .withAlgorithm("MOST_USED_ALGORITHM_LOG_COUNT")
      .uniquePerDay()
      .setDirectory("dir-1")
      .setDays(30)
      .build();
    expect(f).toEqual({
      mode: "most_used",
      directory_id: "dir-1",
      days: 30,
      algorithm: "MOST_USED_ALGORITHM_LOG_COUNT",
      unique_per_day: true,
    });
  });
});
