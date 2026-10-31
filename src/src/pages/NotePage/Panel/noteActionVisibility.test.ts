// Tier-1 test for the note toolbar's conditional-action rules.
//
// The rule that matters most here is the product contract: public
// viewers never get the Share action, regardless of whether the share
// grants write access. Delete is likewise owner-only, while Save
// follows the writable + edit-mode gate.

import { describe, expect, it } from "vitest";

import { getNoteActionVisibility } from "./noteActionVisibility";

describe("getNoteActionVisibility", () => {
  describe("private (owner) sessions", () => {
    it("shows Save only while editing a writable session", () => {
      expect(
        getNoteActionVisibility({
          isPublic: false,
          readOnly: false,
          editMode: true,
        }).showSave,
      ).toBe(true);
      expect(
        getNoteActionVisibility({
          isPublic: false,
          readOnly: false,
          editMode: false,
        }).showSave,
      ).toBe(false);
      expect(
        getNoteActionVisibility({
          isPublic: false,
          readOnly: true,
          editMode: true,
        }).showSave,
      ).toBe(false);
    });

    it("shows Share and Delete for a writable session", () => {
      const visibility = getNoteActionVisibility({
        isPublic: false,
        readOnly: false,
        editMode: false,
      });
      expect(visibility.showShare).toBe(true);
      expect(visibility.showDelete).toBe(true);
    });

    it("hides Delete on a read-only session", () => {
      expect(
        getNoteActionVisibility({
          isPublic: false,
          readOnly: true,
          editMode: false,
        }).showDelete,
      ).toBe(false);
    });
  });

  describe("public viewers", () => {
    it("never shows Share, even on a write-granted share", () => {
      expect(
        getNoteActionVisibility({
          isPublic: true,
          readOnly: false,
          editMode: true,
        }).showShare,
      ).toBe(false);
      expect(
        getNoteActionVisibility({
          isPublic: true,
          readOnly: true,
          editMode: false,
        }).showShare,
      ).toBe(false);
    });

    it("never shows Delete", () => {
      expect(
        getNoteActionVisibility({
          isPublic: true,
          readOnly: false,
          editMode: true,
        }).showDelete,
      ).toBe(false);
    });

    it("still shows Save for a write-granted session in edit mode", () => {
      expect(
        getNoteActionVisibility({
          isPublic: true,
          readOnly: false,
          editMode: true,
        }).showSave,
      ).toBe(true);
    });
  });
});
