import { Box, Stack, Typography, useTheme } from "@mui/material";
import { TextTrail } from "../../components/search/SearchResultsOverlay";
import { M4, M5 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { LogoSvgComponent } from "../LoadingPage/Main";

export const EmptyLandingPage: React.FC = () => {
  const { theme } = useThemeStore();
  return (
    <Stack
      direction="row"
      sx={{
        position: "absolute",
        height: 5 / 8, // golden rule
        justifyContent: "space-evenly",
      }}
    >
      <Stack
        sx={{
          width: 5 / 8,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <TextTrail>
          <Typography variant="h2" sx={{ color: theme.palette.primary.light }}>
            {" "}
            Welcome to WerSu!{" "}
          </Typography>
          <Typography
            variant="h3"
            color="TextSecondary"
            sx={{ color: theme.palette.secondary.light }}
          >
            {" "}
            Time to create your first note{" "}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              color: theme.palette.secondary.light,
              fontStyle: "italic",
              fontWeight: 100,
            }}
          >
            {" "}
            For that press the button at the bottom right{" "}
          </Typography>
        </TextTrail>
      </Stack>
      <Box sx={{ width: 3 / 8 }}>
        <LogoSvgComponent />
      </Box>
    </Stack>
  );
};
