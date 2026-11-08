import { useEffect, useRef, useState } from "react";
import { Box, Slide, Stack, Typography, useTheme } from "@mui/material";
import ShelvesIcon from "@mui/icons-material/Shelves";
import type { UseQueryResult } from "@tanstack/react-query";
import { useUserStore } from "../../zustand/userStore";
import { useStats } from "../../api/queries/useStats";
import type { CalculatedStatsReply } from "../../api/models/stats";
import { ACCENT_FONT_FAMILY } from "../../theme/customTheme";
import { useAppReducedMotion } from "../../hooks/useAppReducedMotion";
import { getGreeting } from "./homeGreetingUtils";

/** Timings for the greeting/stats cycle, in milliseconds. */
export const HOME_GREETING_TIMING = {
  /** How long the greeting is shown before switching to the first stat. */
  greetingDurationMs: 7_000,
  /** How long after mount the lazy stats request starts. */
  statsLoadDelayMs: 4_000,
  /** How long the note count is shown. */
  notesDurationMs: 4_000,
  /** How long the character count is shown. */
  charactersDurationMs: 3_000,
  /** How long the single books-and-chapters view is shown. */
  libraryDurationMs: 3_000,
} as const;

type GreetingMode = "greeting" | "notes" | "characters" | "library";

/** Screens of the cycle, in display order. */
const MODE_SEQUENCE: readonly GreetingMode[] = [
  "greeting",
  "notes",
  "characters",
  "library",
];

const MODE_DURATIONS_MS: Record<GreetingMode, number> = {
  greeting: HOME_GREETING_TIMING.greetingDurationMs,
  notes: HOME_GREETING_TIMING.notesDurationMs,
  characters: HOME_GREETING_TIMING.charactersDurationMs,
  library: HOME_GREETING_TIMING.libraryDurationMs,
};

const nextMode = (mode: GreetingMode): GreetingMode =>
  MODE_SEQUENCE[(MODE_SEQUENCE.indexOf(mode) + 1) % MODE_SEQUENCE.length];

const formatStatValue = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const AccentWord: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ textTransform: "capitalize" }}>
    {children}
  </Box>
);

/**
 * The number mark is a hand-marked swipe rather than a straight rounded
 * rectangle: the same chip, but with a barely-there wave along its edges and
 * a slight tilt, so it reads like one quick pencil sweep. It is completely
 * static - the character lives in the silhouette, never in an animation.
 */
const StatValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      position: "relative",
      // Keep the negative-z mark inside this box's paint layer so it sits
      // above the page background but behind the digits.
      isolation: "isolate",
      display: "inline-flex",
      alignItems: "center",
      mx: 0.75,
      px: 1,
      py: 0.125,
      lineHeight: 1.4,
      color: "primary.contrastText",
    }}
  >
    <Box
      component="svg"
      aria-hidden
      focusable="false"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      sx={{
        position: "absolute",
        inset: "-3px -8px",
        width: "calc(100% + 16px)",
        height: "calc(100% + 6px)",
        zIndex: -1,
        overflow: "visible",
        color: "primary.main",
        transform: "rotate(-1.3deg) skewX(-1deg)",
      }}
    >
      <path
        d="M3 10.5 C 20 7.6, 44 7.2, 66 8.4 C 84 9.4, 93 10.6, 97 11.4 C 98.2 14.2, 98 18, 96.4 21 C 88 23.4, 72 24, 56 23.2 C 40 22.6, 22 22, 9 23.2 C 5.4 23.8, 3 22.8, 2.2 20 C 1.6 16.8, 1.8 13.4, 3 10.5 Z"
        fill="currentColor"
      />
    </Box>
    {children}
  </Box>
);

const GreetingContent: React.FC = () => {
  const user = useUserStore((s) => s.user);
  const theme = useTheme();
  const greeting = getGreeting(new Date().getHours());
  const avatarUrl =
    user && typeof user.getAvatarUrl === "function"
      ? user.getAvatarUrl()
      : undefined;

  return (
    <Stack spacing={0.5}>
      <Typography
        variant="h4"
        color="textPrimary"
        sx={{
          fontFamily: theme.custom?.accentFontFamily ?? ACCENT_FONT_FAMILY,
          fontWeight: 300,
        }}
      >
        {greeting}
        {user ? `, ${user.username}` : ""}
        {/* The avatar sits inline right after the name, at text size. */}
        {avatarUrl && (
          <Box
            component="img"
            src={avatarUrl}
            alt=""
            aria-hidden
            sx={{
              display: "inline-block",
              width: "1.2em",
              height: "1.2em",
              ml: "0.35em",
              borderRadius: "50%",
              objectFit: "cover",
              verticalAlign: "-0.3em",
            }}
          />
        )}
      </Typography>
    </Stack>
  );
};

const StatLine: React.FC<{
  children: React.ReactNode;
  /** Drop the "Library contains" prefix (used by the error fallback). */
  withPrefix?: boolean;
}> = ({ children, withPrefix = true }) => {
  const theme = useTheme();

  return (
    <Typography
      component="p"
      variant="h5"
      aria-label="Your stats"
      color="text.primary"
      sx={{
        lineHeight: 2,
        fontFamily: theme.custom?.accentFontFamily ?? ACCENT_FONT_FAMILY,
        fontWeight: 300,
      }}
    >
      {withPrefix && (
        <>
          {/* Shelf glyph marks the whole line, so it uses the plain text
              colour instead of competing with the primary stat icons. */}
          <ShelvesIcon
            aria-hidden
            sx={{
              fontSize: "0.8em",
              color: "text.primary",
              mr: 0.5,
              verticalAlign: "-0.08em",
            }}
          />
          Library contains{" "}
        </>
      )}
      {children}
    </Typography>
  );
};

/** Shown in place of a number until the stats row has loaded. */
const PENDING_VALUE = "–";

const StatsContent: React.FC<{
  mode: Exclude<GreetingMode, "greeting">;
  stats: UseQueryResult<CalculatedStatsReply, Error>;
}> = ({ mode, stats }) => {
  // Keep the fallback states to one line so they never make the reserved
  // slot taller than the loaded screens while the greeting is showing.
  if (stats.isError) {
    return <StatLine withPrefix={false}>Stats unavailable</StatLine>;
  }

  const row = stats.data;
  // Every stat screen is mounted all the time (the slot must keep its
  // height), so pending screens render the loaded line shape with dashes
  // instead of shrinking to a spinner-sized line.
  const format = (value: number | undefined): string =>
    value === undefined ? PENDING_VALUE : formatStatValue(value);

  switch (mode) {
    case "notes":
      return (
        <StatLine>
          <StatValue>{format(row?.total_notes)}</StatValue>{" "}
          <AccentWord>Notes</AccentWord>
        </StatLine>
      );
    case "characters":
      return (
        <StatLine>
          <StatValue>{format(row?.total_chars)}</StatValue>{" "}
          <AccentWord>Characters</AccentWord>
        </StatLine>
      );
    case "library":
      return (
        <StatLine>
          <StatValue>{format(row?.total_books)}</StatValue>{" "}
          <AccentWord>Books</AccentWord> and{" "}
          <StatValue>{format(row?.total_chapters)}</StatValue>{" "}
          <AccentWord>Chapters</AccentWord>
        </StatLine>
      );
  }
};

/**
 * Personalised header for the Home page.
 *
 * Starts as a time-of-day greeting with the viewer's username. The stats
 * request starts lazily after four seconds; at seven seconds the greeting
 * slides up and away and a sequence of stat screens slides up into view -
 * notes (4s), characters (3s), then books and chapters together (3s) -
 * before the greeting slides back up and the cycle repeats. Every screen
 * stays mounted in one grid cell, so the header reserves the tallest of them
 * and nothing below it reflows while they slide.
 */
export const HomeGreeting: React.FC = () => {
  const theme = useTheme();
  const [mode, setMode] = useState<GreetingMode>("greeting");
  const [statsEnabled, setStatsEnabled] = useState(false);
  const stats = useStats(undefined, { enabled: statsEnabled });
  const reduceMotion = useAppReducedMotion();
  // Slide needs a container to travel within; without one it would slide in
  // from the edge of the viewport, which is far too much motion for a header.
  const slotRef = useRef<HTMLDivElement>(null);
  const slideTimeout = reduceMotion ? 0 : theme.transitions.duration.standard;
  const slideEasing = theme.transitions.easing.easeInOut;

  useEffect(() => {
    if (mode === "greeting") {
      // Start the request a few seconds in, so the first frame stays cheap.
      // Later cycles reuse the cached row when it is still fresh.
      const loadTimer = window.setTimeout(
        () => setStatsEnabled(true),
        HOME_GREETING_TIMING.statsLoadDelayMs,
      );
      const switchTimer = window.setTimeout(
        () => setMode("notes"),
        HOME_GREETING_TIMING.greetingDurationMs,
      );

      return () => {
        window.clearTimeout(loadTimer);
        window.clearTimeout(switchTimer);
      };
    }

    const switchTimer = window.setTimeout(() => {
      const next = nextMode(mode);
      // Back at the greeting: drop the stats branch so the next cycle
      // starts from a fresh (lazily triggered) request.
      if (next === "greeting") setStatsEnabled(false);
      setMode(next);
    }, MODE_DURATIONS_MS[mode]);
    return () => window.clearTimeout(switchTimer);
  }, [mode]);

  // Every screen stays mounted and shares a single grid cell, so the slot is
  // always as tall as the tallest screen. A hidden screen keeps its box
  // (MUI Slide only sets `visibility: hidden`), so switching screens never
  // changes the page height and nothing below the header jumps. The slot
  // clips the slides, which keeps the travel to the header's own height.
  const layerSx = { gridArea: "1 / 1", minWidth: 0 } as const;
  const slideContainer = () => slotRef.current as HTMLElement;

  return (
    <Box
      ref={slotRef}
      sx={{
        display: "grid",
        // Centre the shorter screen inside the taller slot instead of
        // letting it sit pinned to the top of the reserved space.
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {MODE_SEQUENCE.map((screen) => (
        <Slide
          key={screen}
          in={mode === screen}
          appear={false}
          // Everything moves upwards: MUI parks a hidden child on the side
          // given by `direction`, so the active screen comes up from below,
          // while the outgoing one (now inactive) parks above and leaves
          // upwards.
          direction={mode === screen ? "up" : "down"}
          container={slideContainer}
          timeout={slideTimeout}
          easing={slideEasing}
        >
          <Box aria-hidden={mode !== screen} sx={layerSx}>
            {screen === "greeting" ? (
              <GreetingContent />
            ) : (
              <StatsContent mode={screen} stats={stats} />
            )}
          </Box>
        </Slide>
      ))}
    </Box>
  );
};
