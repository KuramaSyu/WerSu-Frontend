import { Stack, Typography } from "@mui/material";
import { useUserStore } from "../../zustand/userStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import type { MinimalNote } from "../../api/models/search";
import { countNotesEditedToday, getGreeting } from "./homeGreetingUtils";

export interface HomeGreetingProps {
  /** Recently updated notes, used only to count how many were touched today. */
  notes?: MinimalNote[];
}

/**
 * Personalised header for the Home page: a time-of-day greeting with the
 * viewer's username and a one-line summary of today's editing activity.
 */
export const HomeGreeting: React.FC<HomeGreetingProps> = ({ notes }) => {
  const username = useUserStore((s) => s.user?.username);
  const { theme } = useThemeStore();

  const greeting = getGreeting(new Date().getHours());
  const editedToday = countNotesEditedToday(notes);

  const summary =
    editedToday === 0
      ? "Nothing edited yet today — pick up where you left off below."
      : `You edited ${editedToday} note${editedToday === 1 ? "" : "s"} today.`;

  return (
    <Stack spacing={0.5}>
      <Typography variant="h4" color="textPrimary">
        {greeting}
        {username ? `, ${username}` : ""}.
      </Typography>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
        {summary}
      </Typography>
    </Stack>
  );
};
