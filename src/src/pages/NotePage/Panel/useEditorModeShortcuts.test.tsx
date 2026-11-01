// @vitest-environment jsdom

import "../../../test/setup";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useEditorModeShortcuts } from "./useEditorModeShortcuts";

const setModes = (viewMode: "source" | "rich", editMode: boolean) => {
  act(() => {
    useEditorSettings.setState({ viewMode, editMode });
  });
};

const availableLabels = (
  shortcuts: ReturnType<typeof useEditorModeShortcuts>["shortcuts"],
) => shortcuts.filter((s) => s.available).map((s) => s.label);

describe("useEditorModeShortcuts", () => {
  const WIDTH_LABELS = ["Normal width", "Wide width", "Full width"];

  it("offers S (open source) in rich/read, alongside I and the widths", () => {
    setModes("rich", false);
    const { result } = renderHook(() => useEditorModeShortcuts());

    expect(availableLabels(result.current.shortcuts)).toEqual([
      "Enter insert mode",
      "Open source editor",
      ...WIDTH_LABELS,
    ]);
  });

  it("offers S (open source) in rich/insert, alongside leaving insert", () => {
    setModes("rich", true);
    const { result } = renderHook(() => useEditorModeShortcuts());

    expect(availableLabels(result.current.shortcuts)).toEqual([
      "Leave insert mode",
      "Open source editor",
      ...WIDTH_LABELS,
    ]);
  });

  it("only offers leaving source and the widths in source/insert", () => {
    setModes("source", true);
    const { result } = renderHook(() => useEditorModeShortcuts());

    expect(availableLabels(result.current.shortcuts)).toEqual([
      "Leave source editor",
      ...WIDTH_LABELS,
    ]);
  });

  it("offers leaving source and entering insert in source/read", () => {
    setModes("source", false);
    const { result } = renderHook(() => useEditorModeShortcuts());

    expect(availableLabels(result.current.shortcuts)).toEqual([
      "Leave source editor",
      "Enter insert mode",
      ...WIDTH_LABELS,
    ]);
  });

  it("routes the F/W/N width shortcuts through setWidthMode", () => {
    setModes("rich", false);
    const setWidthMode = vi.fn();
    const { result } = renderHook(() =>
      useEditorModeShortcuts({ setWidthMode }),
    );

    act(() => {
      result.current.shortcuts
        .find((s) => s.label === "Full width")
        ?.onTrigger();
      result.current.shortcuts
        .find((s) => s.label === "Wide width")
        ?.onTrigger();
      result.current.shortcuts
        .find((s) => s.label === "Normal width")
        ?.onTrigger();
    });

    expect(setWidthMode.mock.calls.map(([mode]) => mode)).toEqual([
      "full",
      "wide",
      "normal",
    ]);
  });

  it("serialises the rich editor when opening source", () => {
    setModes("rich", false);
    const editor = { getMarkdown: () => "# serialised" } as unknown as Editor;
    act(() => {
      useActiveNoteStore.setState({ editor, sourceMarkdown: "stale" });
    });

    const { result } = renderHook(() => useEditorModeShortcuts());
    const openSource = result.current.shortcuts.find(
      (s) => s.label === "Open source editor",
    );
    act(() => {
      openSource?.onTrigger();
    });

    expect(useEditorSettings.getState().viewMode).toBe("source");
    expect(useActiveNoteStore.getState().sourceMarkdown).toBe("# serialised");
  });

  it("toggles insert mode through the I and Escape actions", () => {
    setModes("rich", false);
    const { result } = renderHook(() => useEditorModeShortcuts());

    act(() => {
      result.current.shortcuts
        .find((s) => s.label === "Enter insert mode")
        ?.onTrigger();
    });
    expect(useEditorSettings.getState().editMode).toBe(true);

    // Re-render against the new state so the contextual Escape appears.
    const { result: next } = renderHook(() => useEditorModeShortcuts());
    act(() => {
      next.current.shortcuts
        .find((s) => s.label === "Leave insert mode")
        ?.onTrigger();
    });
    expect(useEditorSettings.getState().editMode).toBe(false);
  });
});
