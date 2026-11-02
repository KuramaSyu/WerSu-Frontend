import { Stack, Typography } from "@mui/material";
import { useUserStore } from "../../zustand/userStore";
import { getGreeting } from "./homeGreetingUtils";

/**
 * Personalised header for the Home page: a time-of-day greeting with the
 * viewer's username.
 */
export const HomeGreeting: React.FC = () => {
  const username = useUserStore((s) => s.user?.username);

  const greeting = getGreeting(new Date().getHours());

  return (
    <Stack spacing={0.5}>
      <Typography variant="h4" color="textPrimary">
        {greeting}
        {username ? `, ${username}` : ""}
      </Typography>
    </Stack>
  );
};
