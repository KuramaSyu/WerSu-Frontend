import React, { useEffect, useState } from "react";
import { HoldKeyActionBar } from "../components/HoldKeyActionBar";
import { ShortcutPulse } from "../components/ShortcutPulse";

/** TEMPORARY reproduction harness for the hold-bar pulse bug. */
export const ShortcutRepro: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState("read");

  // Simulate the editor's frequent re-renders while a key is held.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 50);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div>
      <div data-testid="tick">{tick}</div>
      <div data-testid="mode">{mode}</div>
      <HoldKeyActionBar
        active
        duration={400}
        actions={[
          {
            key: "i",
            keyLabel: "I",
            label: "Enter insert mode",
            onTrigger: () => setMode("insert"),
          },
        ]}
      />
      <ShortcutPulse />
    </div>
  );
};

export default ShortcutRepro;
