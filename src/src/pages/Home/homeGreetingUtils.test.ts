// Tier-1 unit tests for the Home greeting helpers.

import { describe, expect, it } from "vitest";

import { countNotesEditedToday, getGreeting } from "./homeGreetingUtils";
import type { MinimalNote } from "../../api/models/search";

const makeNote = (updatedAt: string): MinimalNote => ({
  id: "n-1",
  title: "Note",
  author_id: "u-1",
  updated_at: updatedAt,
  stripped_content: "",
  directory_ids: [],
  tag_ids: [],
});

describe("getGreeting", () => {
  it("maps each part of the day to its greeting", () => {
    expect(getGreeting(0)).toBe("Good night");
    expect(getGreeting(4)).toBe("Good night");
    expect(getGreeting(5)).toBe("Good morning");
    expect(getGreeting(11)).toBe("Good morning");
    expect(getGreeting(12)).toBe("Good afternoon");
    expect(getGreeting(17)).toBe("Good afternoon");
    expect(getGreeting(18)).toBe("Good evening");
    expect(getGreeting(23)).toBe("Good evening");
  });
});

describe("countNotesEditedToday", () => {
  const now = new Date(2026, 0, 15, 20, 0, 0);

  it("returns 0 for undefined or empty input", () => {
    expect(countNotesEditedToday(undefined, now)).toBe(0);
    expect(countNotesEditedToday([], now)).toBe(0);
  });

  it("counts only notes updated on the same local day", () => {
    const notes = [
      makeNote(new Date(2026, 0, 15, 9, 0, 0).toISOString()),
      makeNote(new Date(2026, 0, 15, 23, 59, 0).toISOString()),
      makeNote(new Date(2026, 0, 14, 23, 59, 0).toISOString()),
      makeNote(new Date(2026, 0, 16, 0, 0, 0).toISOString()),
    ];
    expect(countNotesEditedToday(notes, now)).toBe(2);
  });
});
