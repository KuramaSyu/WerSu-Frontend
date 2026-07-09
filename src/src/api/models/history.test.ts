// Pure-helper tests for the `Activity` and `ActivityScore` wrapper classes; pins the contract of `is_note` / `get_note`.

import { describe, expect, it } from "vitest";
import {
  Activity,
  ActivityScore,
  type ActivityReply,
  type ActivityScoreReply,
} from "./history";

const NOTE_ID = "note-1";
const NOTE_TITLE = "My Title";
const NOTE_CONTENT = "Some content body";

const noteRow = (overrides: Partial<ActivityReply> = {}): ActivityReply => ({
  id: "ev-1",
  actor_id: "user-1",
  accessed_as: "ACCESSED_AS_USER",
  action: "note_edited",
  note_id: NOTE_ID,
  directory_id: "",
  role_id: "",
  at: "2026-07-06T12:00:00Z",
  metadata_json: JSON.stringify({
    note_title: NOTE_TITLE,
    note_content: NOTE_CONTENT,
  }),
  ...overrides,
});

const scoreRow = (
  overrides: Partial<ActivityScoreReply> = {},
): ActivityScoreReply => ({
  note_id: NOTE_ID,
  score: 12.5,
  ...overrides,
});

describe("Activity - construction", () => {
  it("copies every field from the wire shape", () => {
    const row = noteRow();
    const activity = Activity.fromJson(row);
    expect(activity).toBeInstanceOf(Activity);
    expect(activity.id).toBe(row.id);
    expect(activity.actor_id).toBe(row.actor_id);
    expect(activity.accessed_as).toBe(row.accessed_as);
    expect(activity.action).toBe(row.action);
    expect(activity.note_id).toBe(row.note_id);
    expect(activity.directory_id).toBe(row.directory_id);
    expect(activity.role_id).toBe(row.role_id);
    expect(activity.at).toBe(row.at);
    expect(activity.metadata_json).toBe(row.metadata_json);
  });
});

describe("Activity.is_note", () => {
  it("returns true for every note_* action", () => {
    const noteActions: ActivityReply["action"][] = [
      "note_viewed",
      "note_created",
      "note_edited",
      "note_deleted",
      "note_published",
      "note_shared",
      "note_unshared",
      "note_restored",
      "note_archived",
      "note_version_restored",
      "note_attachment_added",
    ];
    for (const action of noteActions) {
      const activity = Activity.fromJson(noteRow({ action }));
      expect(activity.is_note()).toBe(true);
    }
  });

  it("returns false for directory_* actions", () => {
    const dirActions: ActivityReply["action"][] = [
      "directory_created",
      "directory_viewed",
      "directory_edited",
      "directory_deleted",
    ];
    for (const action of dirActions) {
      const activity = Activity.fromJson(
        noteRow({
          action,
          note_id: "",
          directory_id: "dir-1",
          metadata_json: "{}",
        }),
      );
      expect(activity.is_note()).toBe(false);
    }
  });

  it("returns false for role_* actions", () => {
    const roleActions: ActivityReply["action"][] = [
      "role_grant",
      "role_revoke",
      "role_change",
    ];
    for (const action of roleActions) {
      const activity = Activity.fromJson(
        noteRow({
          action,
          note_id: "",
          role_id: "role-1",
          metadata_json: "{}",
        }),
      );
      expect(activity.is_note()).toBe(false);
    }
  });
});

describe("Activity.get_note", () => {
  it("returns a MinimalNote with id, title and stripped content for a note event", () => {
    const activity = Activity.fromJson(noteRow());
    const note = activity.get_note();
    expect(note).toBeDefined();
    expect(note?.id).toBe(NOTE_ID);
    expect(note?.title).toBe(NOTE_TITLE);
    expect(note?.stripped_content).toBe(NOTE_CONTENT);
  });

  it("fills author_id and updated_at with empty strings (not on the wire)", () => {
    const activity = Activity.fromJson(noteRow());
    const note = activity.get_note();
    expect(note?.author_id).toBe("");
    expect(note?.updated_at).toBe("");
  });

  it("returns undefined for a non-note event", () => {
    const activity = Activity.fromJson(
      noteRow({
        action: "directory_created",
        note_id: "",
        directory_id: "dir-1",
        metadata_json: "{}",
      }),
    );
    expect(activity.get_note()).toBeUndefined();
  });

  it("returns undefined when metadata_json is not valid JSON", () => {
    const activity = Activity.fromJson(noteRow({ metadata_json: "not-json{" }));
    expect(activity.get_note()).toBeUndefined();
  });

  it("returns undefined when metadata_json is missing note_title", () => {
    const activity = Activity.fromJson(
      noteRow({
        metadata_json: JSON.stringify({ note_content: NOTE_CONTENT }),
      }),
    );
    expect(activity.get_note()).toBeUndefined();
  });

  it("returns undefined when metadata_json is missing note_content", () => {
    const activity = Activity.fromJson(
      noteRow({
        metadata_json: JSON.stringify({ note_title: NOTE_TITLE }),
      }),
    );
    expect(activity.get_note()).toBeUndefined();
  });
});

describe("ActivityScore - construction", () => {
  it("copies every field from the wire shape", () => {
    const row = scoreRow({
      title: "Score Title",
      stripped_content: "Score preview",
    });
    const score = ActivityScore.fromJson(row);
    expect(score).toBeInstanceOf(ActivityScore);
    expect(score.note_id).toBe(row.note_id);
    expect(score.score).toBe(row.score);
    expect(score.title).toBe("Score Title");
    expect(score.stripped_content).toBe("Score preview");
  });

  it("keeps title and stripped_content undefined when the backend omits them", () => {
    const score = ActivityScore.fromJson(scoreRow());
    expect(score.title).toBeUndefined();
    expect(score.stripped_content).toBeUndefined();
  });
});

describe("ActivityScore.get_note", () => {
  it("returns a MinimalNote with id, title and stripped content", () => {
    const score = ActivityScore.fromJson(
      scoreRow({
        title: "Score Title",
        stripped_content: "Score preview",
      }),
    );
    const note = score.get_note();
    expect(note.id).toBe(NOTE_ID);
    expect(note.title).toBe("Score Title");
    expect(note.stripped_content).toBe("Score preview");
  });

  it("fills author_id and updated_at with empty strings (not on the wire)", () => {
    const score = ActivityScore.fromJson(scoreRow());
    const note = score.get_note();
    expect(note.author_id).toBe("");
    expect(note.updated_at).toBe("");
  });

  it("substitutes empty strings when title and stripped_content are omitted", () => {
    const score = ActivityScore.fromJson(scoreRow());
    const note = score.get_note();
    expect(note.title).toBe("");
    expect(note.stripped_content).toBe("");
  });

  it("does not set permissions (left undefined for the consumer to fill)", () => {
    const score = ActivityScore.fromJson(scoreRow());
    const note = score.get_note();
    expect(note.permissions).toBeUndefined();
  });
});
