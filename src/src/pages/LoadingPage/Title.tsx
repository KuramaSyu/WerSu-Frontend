import { Box, Divider, keyframes } from "@mui/material";
import React from "react";
import type { CustomTheme } from "../../theme/customTheme";

// Vertical bar grows from its centre -- the "line at the start"
const dividerGrow = keyframes`
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
`;

// Blinking caret. `step-end` keeps each half hard on/off so it
// reads as a typewriter cursor instead of a soft fade.
const barBlink = keyframes`
  0%, 49%   { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

// One keystroke. The divider delay + draw are tuned against it.
const CHAR_TIME = 0.07;
const DIVIDER_DELAY = 0.2;
const DIVIDER_DURATION = 0.3;
// Line is fully drawn before the typewriter starts.
const TYPE_START = DIVIDER_DELAY + DIVIDER_DURATION;

// The words the typewriter spells out. Whitespace between them
// lives in the JSX so it stays selectable / screen-reader
// friendly from the first paint.
const TYPE_WORDS = ["Wer", "Sucht,", "Der", "Findet."];
const TOTAL_LETTERS = TYPE_WORDS.reduce((acc, w) => acc + w.length, 0);

// Typewriter: after `startDelay` seconds, reveal one letter every
// `charTime` until everything is typed. Exposed as a hook so the
// component only reads counts and never touches timers.
const useTypewriter = ({
  charTime,
  startDelay,
  enabled,
}: {
  charTime: number;
  startDelay: number;
  enabled: boolean;
}): number => {
  // Lazy init so the disabled case shows the final state on first
  // paint without a setState-in-effect cascade.
  const [count, setCount] = React.useState(() => (enabled ? 0 : TOTAL_LETTERS));

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = 0;
    const step = () => {
      if (cancelled) return;
      i += 1;
      setCount(i);
      if (i < TOTAL_LETTERS) {
        timers.push(setTimeout(step, charTime * 1000));
      }
    };
    timers.push(setTimeout(step, startDelay * 1000));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [enabled, charTime, startDelay]);

  return count;
};

export interface TitleProps {
  theme: CustomTheme;
  color1?: string;
  color2?: string;
  // Plays the wordmark intro: Wer Su sits static on the left, the
  // vertical bar grows from its centre, then the right-side column
  // ("Wer Sucht," / "Der Findet.") types in letter-by-letter with a
  // blinking caret that follows the active word.
  animate?: boolean;
}

// Static colour word on the left of the divider.
const StaticWord: React.FC<{ children: string; fg: string }> = ({
  children,
  fg,
}) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      color: fg,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </Box>
);

// One word in the typewriter. Slices `text` to `visible` chars and
// shows a caret next to the last visible char while `showCursor`.
const TypedWord: React.FC<{
  text: string;
  visible: number;
  fg: string;
  // True only for the word currently receiving keystrokes. Other
  // words stay caret-free so the cursor doesn't double up on the
  // line.
  showCursor: boolean;
}> = ({ text, visible, fg, showCursor }) => (
  <Box
    component="span"
    sx={{
      position: "relative",
      display: "inline-block",
      color: fg,
      whiteSpace: "nowrap",
    }}
  >
    {text.slice(0, visible)}
    {showCursor && (
      <Box
        component="span"
        aria-hidden
        sx={{
          display: "inline-block",
          width: "0.06em",
          height: "1em",
          marginLeft: "0.04em",
          backgroundColor: "currentColor",
          verticalAlign: "text-bottom",
          transform: "translateY(0.12em)",
          animation: `${barBlink} 0.5s step-end infinite`,
        }}
      />
    )}
  </Box>
);

export const Title: React.FC<TitleProps> = ({
  theme,
  color1,
  color2,
  animate = false,
}) => {
  // Single, continuous letter counter shared by every word.
  const typed = useTypewriter({
    charTime: CHAR_TIME,
    startDelay: TYPE_START,
    enabled: animate,
  });

  // Per-word split: each word starts at `offsets[i]` letters in, so
  // its visible count is `typed - offsets[i]` clamped to its length.
  // Spaces between words live in the JSX, not in this array.
  const visibleCounts = React.useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const w of TYPE_WORDS) {
      offsets.push(acc);
      acc += w.length;
    }
    return TYPE_WORDS.map((w, i) =>
      Math.min(w.length, Math.max(0, typed - offsets[i])),
    );
  }, [typed]);

  // The "active" word is whichever one still has letters left;
  // the caret rides on its tail. Once everything is fully typed,
  // no word owns it and the cursor disappears.
  const activeIdx = visibleCounts.findIndex(
    (count, i) => count < TYPE_WORDS[i].length,
  );

  // Resting colors. Wer uses primary, Su uses secondary (with
  // optional color1 / color2 overrides); the right-side column
  // is text.primary throughout.
  const werRest = color1 || theme.palette.primary.main;
  const suRest = color2 || theme.palette.secondary.main;
  const rightRest = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        fontWeight: 200,
        fontSize: "inherit",
        whiteSpace: "nowrap",
        flexWrap: "nowrap",
      }}
    >
      <StaticWord fg={werRest}>Wer</StaticWord>
      <StaticWord fg={suRest}>Su</StaticWord>
      <Divider
        flexItem
        orientation="vertical"
        sx={{
          borderColor: theme.palette.primary.light,
          borderWidth: 1,
          height: "1em",
          alignSelf: "center",
          ...(animate && {
            transform: "scaleY(0)",
            transformOrigin: "center",
            animation: `${dividerGrow} ${DIVIDER_DURATION}s ${DIVIDER_DELAY}s ease-out forwards`,
          }),
        }}
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          fontFamily: "inherit",
          fontSize: "calc(1em / 3.5)",
          fontWeight: "inherit",
          marginLeft: "0.25rem",
          whiteSpace: "nowrap",
        }}
      >
        <Box sx={{ whiteSpace: "nowrap" }}>
          <TypedWord
            text={TYPE_WORDS[0]}
            visible={visibleCounts[0]}
            fg={rightRest}
            showCursor={activeIdx === 0}
          />{" "}
          <TypedWord
            text={TYPE_WORDS[1]}
            visible={visibleCounts[1]}
            fg={rightRest}
            showCursor={activeIdx === 1}
          />
        </Box>
        <Box sx={{ whiteSpace: "nowrap" }}>
          <TypedWord
            text={TYPE_WORDS[2]}
            visible={visibleCounts[2]}
            fg={rightRest}
            showCursor={activeIdx === 2}
          />{" "}
          <TypedWord
            text={TYPE_WORDS[3]}
            visible={visibleCounts[3]}
            fg={rightRest}
            showCursor={activeIdx === 3}
          />
        </Box>
      </Box>
    </Box>
  );
};
