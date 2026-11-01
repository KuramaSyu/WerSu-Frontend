// @vitest-environment jsdom

import "../test/setup";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HoldKeyActionBar } from "./HoldKeyActionBar";
import { useShortcutPulseStore } from "../zustand/useShortcutPulseStore";

beforeEach(() => {
  useShortcutPulseStore.setState({ pulse: null });
});

describe("repro", () => {
  it("still pulses when the parent rerenders mid-hold", () => {
    const onTrigger = vi.fn();

    const Wrapper = () => {
      const [n, setN] = useState(0);
      // Force re-renders while the hold is in flight.
      (window as unknown as { bump: () => void }).bump = () => setN((v) => v + 1);
      return (
        <>
          <span data-testid="n">{n}</span>
          <HoldKeyActionBar
            active
            duration={400}
            actions={[
              { key: "i", keyLabel: "I", label: "Enter insert mode", onTrigger },
            ]}
          />
        </>
      );
    };

    render(<Wrapper />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
    });
    const fill = screen.getByTestId("hold-key-fill-i");
    (window as unknown as { bump: () => void }).bump();
    fireEvent(fill, new Event("animationend", { bubbles: true }));

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(useShortcutPulseStore.getState().pulse).toMatchObject({ key: "i" });
  });
});
