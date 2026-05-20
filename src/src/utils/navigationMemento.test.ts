import { describe, expect, it } from "vitest";
import { NavigationMemento } from "./navigationMemento";

describe("NavigationMemento", () => {
  it("records paths and returns current", () => {
    const memento = new NavigationMemento();

    memento.record("/a");
    memento.record("/b");

    expect(memento.getCurrent()).toBe("/b");
    expect(memento.canUndo()).toBe(true);
    expect(memento.canRedo()).toBe(false);
  });

  it("undo/redo navigates through history", () => {
    const memento = new NavigationMemento();

    memento.record("/a");
    memento.record("/b");
    memento.record("/c");

    expect(memento.undo()).toBe("/b");
    expect(memento.undo()).toBe("/a");
    expect(memento.canUndo()).toBe(false);

    expect(memento.redo()).toBe("/b");
    expect(memento.redo()).toBe("/c");
    expect(memento.canRedo()).toBe(false);
  });

  it("trims forward history when recording after undo", () => {
    const memento = new NavigationMemento();

    memento.record("/a");
    memento.record("/b");
    memento.record("/c");

    expect(memento.undo()).toBe("/b");
    memento.record("/d");

    expect(memento.canRedo()).toBe(false);
    expect(memento.getCurrent()).toBe("/d");
  });

  it("ignores duplicate consecutive records", () => {
    const memento = new NavigationMemento();

    memento.record("/a");
    memento.record("/a");

    expect(memento.getCurrent()).toBe("/a");
    expect(memento.canUndo()).toBe(false);
  });

  it("skips the next record when requested", () => {
    const memento = new NavigationMemento();

    memento.record("/a");
    memento.skipNextRecord();
    memento.record("/b");

    expect(memento.getCurrent()).toBe("/a");
    expect(memento.canRedo()).toBe(false);
  });
});
