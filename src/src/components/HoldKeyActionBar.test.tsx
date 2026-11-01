// @vitest-environment jsdom

import "../test/setup";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HoldKeyActionBar } from "./HoldKeyActionBar";
import { useShortcutPulseStore } from "../zustand/useShortcutPulseStore";

beforeEach(() => {
  useShortcutPulseStore.setState({ pulse: null });
});

describe("HoldKeyActionBar", () => {
  it("renders nothing when inactive", () => {
    const { container } = render(
      <HoldKeyActionBar
        active={false}
        actions={[{ key: "Escape", label: "exit source mode", onTrigger: vi.fn() }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("hides until the matching key is pressed", () => {
    render(
      <HoldKeyActionBar
        active
        actions={[{ key: "Escape", label: "exit source mode", onTrigger: vi.fn() }]}
      />,
    );

    expect(screen.queryByTestId("hold-key-Escape")).not.toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(screen.getByTestId("hold-key-Escape")).toBeInTheDocument();
  });

  it("shows only the held action, not the others", () => {
    render(
      <HoldKeyActionBar
        active
        actions={[
          { key: "Escape", keyLabel: "ESC", label: "exit source mode", onTrigger: vi.fn() },
          { key: "s", keyLabel: "S", label: "save note", onTrigger: vi.fn() },
        ]}
      />,
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(screen.getByText("ESC")).toBeInTheDocument();
    expect(screen.getByText("exit source mode")).toBeInTheDocument();
    expect(screen.queryByText("S")).not.toBeInTheDocument();
    expect(screen.queryByText("save note")).not.toBeInTheDocument();
  });

  it("triggers the action and emits a pulse when the fill animation ends", () => {
    const onTrigger = vi.fn();
    render(
      <HoldKeyActionBar
        active
        duration={400}
        actions={[{ key: "Escape", keyLabel: "ESC", label: "exit source mode", onTrigger }]}
      />,
    );

    expect(screen.queryByTestId("hold-key-Escape")).not.toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(screen.getByTestId("hold-key-Escape")).toHaveAttribute(
      "data-holding",
      "true",
    );
    const fill = screen.getByTestId("hold-key-fill-Escape");

    expect(onTrigger).not.toHaveBeenCalled();
    fireEvent(fill, new Event("animationend", { bubbles: true }));

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(useShortcutPulseStore.getState().pulse).toMatchObject({
      key: "Escape",
      keyLabel: "ESC",
      label: "exit source mode",
    });
  });

  it("falls back to a timer when the fill animation never ends", () => {
    vi.useFakeTimers();
    try {
      const onTrigger = vi.fn();
      render(
        <HoldKeyActionBar
          active
          duration={400}
          actions={[
            {
              key: "i",
              keyLabel: "I",
              label: "Enter insert mode",
              onTrigger,
            },
          ]}
        />,
      );

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
      });
      expect(screen.getByTestId("hold-key-i")).toBeInTheDocument();
      expect(onTrigger).not.toHaveBeenCalled();

      // No `animationend` is dispatched: the fallback must still
      // complete the hold and register the confirmation pulse.
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(useShortcutPulseStore.getState().pulse).toMatchObject({ key: "i" });
      expect(screen.queryByTestId("hold-key-i")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides a half-finished hold when deactivated", () => {
    const { rerender } = render(
      <HoldKeyActionBar
        active
        duration={400}
        actions={[{ key: "Escape", keyLabel: "ESC", label: "exit source mode", onTrigger: vi.fn() }]}
      />,
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.getByTestId("hold-key-Escape")).toBeInTheDocument();

    rerender(
      <HoldKeyActionBar
        active={false}
        duration={400}
        actions={[{ key: "Escape", keyLabel: "ESC", label: "exit source mode", onTrigger: vi.fn() }]}
      />,
    );

    expect(screen.queryByTestId("hold-key-Escape")).not.toBeInTheDocument();
  });

  it("hides again when the key is released early", () => {
    render(
      <HoldKeyActionBar
        active
        duration={400}
        actions={[{ key: "Escape", keyLabel: "ESC", label: "exit source mode", onTrigger: vi.fn() }]}
      />,
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.getByTestId("hold-key-Escape")).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
    });

    expect(screen.queryByTestId("hold-key-Escape")).not.toBeInTheDocument();
  });
});
