import { useEffect, useState } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import type { UseQueryResult } from "@tanstack/react-query";
import { useUserStore } from "../../zustand/userStore";
import { useStats } from "../../api/queries/useStats";
import type { CalculatedStatsReply } from "../../api/models/stats";
import { ACCENT_FONT_FAMILY } from "../../theme/customTheme";
import { useAppReducedMotion } from "../../hooks/useAppReducedMotion";
import { getGreeting } from "./homeGreetingUtils";

/** Timings for the greeting/stats cycle, in milliseconds. */
export const HOME_GREETING_TIMING = {
  /** How long the greeting is shown before switching to stats. */
  greetingDurationMs: 10_000,
  /** How long after mount the lazy stats request starts. */
  statsLoadDelayMs: 7_000,
  /** How long the stats view is shown before switching back. */
  statsDurationMs: 20_000,
} as const;

type GreetingMode = "greeting" | "stats";

const formatStatValue = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const AccentWord: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ textTransform: "capitalize" }}>
    {children}
  </Box>
);

const StatValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      display: "inline-flex",
      alignItems: "center",
      mx: 0.25,
      px: 0.75,
      py: 0.125,
      borderRadius: 999,
      backgroundColor: "primary.main",
      color: "primary.contrastText",
      lineHeight: 1.2,
    }}
  >
    {children}
  </Box>
);

const GreetingContent: React.FC = () => {
  const username = useUserStore((s) => s.user?.username);
  const theme = useTheme();
  const greeting = getGreeting(new Date().getHours());

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
        {username ? `, ${username}` : ""}
      </Typography>
    </Stack>
  );
};

const StatsContent: React.FC<{
  stats: UseQueryResult<CalculatedStatsReply, Error>;
}> = ({ stats }) => {
  const theme = useTheme();

  if (stats.isPending) {
    return (
      <Stack spacing={0.5}>
        <Typography variant="h4" color="textPrimary">
          Your stats
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Loading your stats…
        </Typography>
      </Stack>
    );
  }

  if (stats.isError) {
    return (
      <Stack spacing={0.5}>
        <Typography variant="h4" color="textPrimary">
          Your stats
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Stats are unavailable right now.
        </Typography>
      </Stack>
    );
  }

  const row = stats.data;

  return (
    <Typography
      component="p"
      variant="h6"
      aria-label="Your stats"
      color="text.primary"
      sx={{
        lineHeight: 2,
        fontFamily: theme.custom?.accentFontFamily ?? ACCENT_FONT_FAMILY,
        fontWeight: 300,
      }}
    >
      Library contains <StatValue>{formatStatValue(row.total_notes)}</StatValue>{" "}
      <AccentWord>Notes</AccentWord> with{" "}
      <StatValue>{formatStatValue(row.total_chars)}</StatValue>{" "}
      <AccentWord>Characters</AccentWord> within{" "}
      <StatValue>{formatStatValue(row.total_chapters)}</StatValue>{" "}
      <AccentWord>Chapters</AccentWord> and{" "}
      <StatValue>{formatStatValue(row.total_books)}</StatValue>{" "}
      <AccentWord>Books</AccentWord>
    </Typography>
  );
};

/**
 * Personalised header for the Home page.
 *
 * Starts as a time-of-day greeting with the viewer's username. The stats
 * request starts lazily after seven seconds; at ten seconds the greeting
 * cross-fades into the precomputed stats row. After twenty seconds of stats,
 * it fades back to the greeting and the cycle repeats.
 */
export const HomeGreeting: React.FC = () => {
  const [mode, setMode] = useState<GreetingMode>("greeting");
  const [statsEnabled, setStatsEnabled] = useState(false);
  const stats = useStats(undefined, { enabled: statsEnabled });
  const reduceMotion = useAppReducedMotion();

  useEffect(() => {
    if (mode === "greeting") {
      // Start the request seven seconds in, so the first frame stays cheap.
      // Later cycles reuse the cached row when it is still fresh.
      const loadTimer = window.setTimeout(
        () => setStatsEnabled(true),
        HOME_GREETING_TIMING.statsLoadDelayMs,
      );
      const switchTimer = window.setTimeout(
        () => setMode("stats"),
        HOME_GREETING_TIMING.greetingDurationMs,
      );

      return () => {
        window.clearTimeout(loadTimer);
        window.clearTimeout(switchTimer);
      };
    }

    const switchTimer = window.setTimeout(() => {
      setStatsEnabled(false);
      setMode("greeting");
    }, HOME_GREETING_TIMING.statsDurationMs);
    return () => window.clearTimeout(switchTimer);
  }, [mode]);

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: "easeInOut" as const };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={transition}
      >
        {mode === "greeting" ? (
          <GreetingContent />
        ) : (
          <StatsContent stats={stats} />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
