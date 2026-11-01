// @vitest-environment jsdom

import "../../test/setup";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectDirectoryNavItems,
  isModalOpen,
  isTypingTarget,
  useDirectoryTypeAhead,
} from "./useDirectoryTypeAhead";
import { useDirectoryTypeAheadStore } from "../../zustand/useDirectoryTypeAheadStore";

const Rows: React.FC = () => {
  useDirectoryTypeAhead();
  return (
    <div>
      <button data-directory-nav="directory:1" data-directory-nav-name="Projects">
        Projects
      </button>
      <button data-directory-nav="directory:2" data-directory-nav-name="Photos">
        Photos
      </button>
      <button data-directory-nav="note:3" data-directory-nav-name="Postmortem">
        Postmortem
      </button>
      <button data-directory-nav="note:4" data-directory-nav-name="Notes">
        Notes
      </button>
    </div>
  );
};

let clock = 0;

const fire = (type: "keydown" | "keyup", key: string, target: EventTarget) => {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
};

/** Press and release a key, advancing the fake clock by `durationMs`. */
const tap = (key: string, durationMs = 0, target: EventTarget = document) => {
  const downAt = clock;
  fire("keydown", key, target);
  clock = downAt + durationMs;
  fire("keyup", key, target);
};

describe("useDirectoryTypeAhead", () => {
  beforeEach(() => {
    clock = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    useDirectoryTypeAheadStore.getState().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("highlights and focuses the first row starting with the tapped letter", () => {
    render(<Rows />);

    tap("p");

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBe(
      "directory:1",
    );
    expect(document.activeElement?.textContent?.trim()).toBe("Projects");
  });

  it("cycles through the matches when the same letter is tapped again", () => {
    render(<Rows />);

    tap("p");
    clock += 50;
    tap("p");
    expect(useDirectoryTypeAheadStore.getState().highlighted).toBe(
      "directory:2",
    );

    clock += 50;
    tap("p");
    expect(useDirectoryTypeAheadStore.getState().highlighted).toBe("note:3");

    clock += 50;
    // Wraps after the last match.
    tap("p");
    expect(useDirectoryTypeAheadStore.getState().highlighted).toBe(
      "directory:1",
    );
  });

  it("starts a fresh sequence after a pause", () => {
    render(<Rows />);

    tap("p");
    clock += 5000;
    tap("p");

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBe(
      "directory:1",
    );
  });

  it("switches to a new letter and starts from its first match", () => {
    render(<Rows />);

    tap("p");
    clock += 50;
    tap("n");

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBe("note:4");
  });

  it("clears the highlight when nothing matches", () => {
    render(<Rows />);

    tap("p");
    clock += 50;
    tap("z");

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBeNull();
  });

  it("leaves long presses to the hold-to-run shortcuts", () => {
    render(<Rows />);

    tap("p", 600);

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBeNull();
  });

  it("ignores letters typed into a text field", () => {
    render(
      <>
        <Rows />
        <input data-testid="field" />
      </>,
    );
    const input = document.querySelector("input")!;

    tap("p", 0, input);

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBeNull();
  });

  it("ignores typing while a modal dialog is open", () => {
    render(<Rows />);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.appendChild(dialog);

    expect(isModalOpen()).toBe(true);
    tap("p");

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBeNull();
    dialog.remove();
  });

  it("drops the highlight on pointer down", () => {
    render(<Rows />);

    tap("p");
    expect(useDirectoryTypeAheadStore.getState().highlighted).not.toBeNull();

    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(useDirectoryTypeAheadStore.getState().highlighted).toBeNull();
  });
});

describe("collectDirectoryNavItems", () => {
  it("reads nav rows in document order", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-directory-nav="directory:1" data-directory-nav-name="Alpha"></div>
      <div data-directory-nav="note:2" data-directory-nav-name="Beta"></div>
    `;

    const items = collectDirectoryNavItems(container);

    expect(items.map((item) => item.key)).toEqual([
      "directory:1",
      "note:2",
    ]);
    // Names are lower-cased for case-insensitive matching.
    expect(items.map((item) => item.name)).toEqual(["alpha", "beta"]);
  });
});

describe("isTypingTarget", () => {
  it("detects inputs and contenteditable hosts", () => {
    const input = document.createElement("input");
    const contentEditable = document.createElement("div");
    // jsdom doesn't implement contentEditable behaviour; stub the getter.
    Object.defineProperty(contentEditable, "isContentEditable", {
      value: true,
    });
    const plain = document.createElement("div");

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(contentEditable)).toBe(true);
    expect(isTypingTarget(plain)).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
  });
});
