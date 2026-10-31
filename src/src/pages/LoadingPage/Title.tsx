import { Box, Divider } from "@mui/material";
import React from "react";
import type { CustomTheme } from "../../theme/customTheme";

export interface TitleProps {
  theme: CustomTheme;
  color1?: string;
  color2?: string;
}

/**
 * The static WerSu wordmark. "Wer Su" sits next to a thin divider with
 * the "Wer Sucht, Der Findet." line stacked beside it. No typewriter,
 * no caret – it is simply written there.
 */
export const Title: React.FC<TitleProps> = ({ theme, color1, color2 }) => {
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
      <Box
        component="span"
        sx={{ display: "inline-block", color: werRest, whiteSpace: "nowrap" }}
      >
        Wer
      </Box>
      <Box
        component="span"
        sx={{ display: "inline-block", color: suRest, whiteSpace: "nowrap" }}
      >
        Su
      </Box>
      <Divider
        flexItem
        orientation="vertical"
        sx={{
          borderColor: theme.palette.primary.light,
          borderWidth: 1,
          height: "1em",
          alignSelf: "center",
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
          color: rightRest,
        }}
      >
        <Box sx={{ whiteSpace: "nowrap" }}>Wer Sucht,</Box>
        <Box sx={{ whiteSpace: "nowrap" }}>Der Findet.</Box>
      </Box>
    </Box>
  );
};
