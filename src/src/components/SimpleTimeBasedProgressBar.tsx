import React from "react";
import Box from "@mui/material/Box";
import type { Theme } from "@mui/material/styles";
import type { ResponsiveStyleValue } from "@mui/system";

export interface SimpleTimeBasedProgressBarProps {
  durationMs: number;
  barColor?:
    | ResponsiveStyleValue<string>
    | ((theme: Theme) => ResponsiveStyleValue<string>)
    | null;
}

/**
 * Makes a simple progress bar from 0% width to 100% width
 * over the given duration in milliseconds
 * @param durationMs Duration in milliseconds
 * @param backgroundColor Background color of the progress bar
 */
export const SimpleTimeBasedProgressBar: React.FC<
  SimpleTimeBasedProgressBarProps
> = ({ durationMs, barColor }) => {
  return (
    <Box
      sx={{
        height: 6,
        width: "0%",
        backgroundColor: barColor ?? "primary.main",
        animation: `progressBar ${durationMs}ms linear forwards`,
        "@keyframes progressBar": {
          to: { width: "100%" },
        },
      }}
    ></Box>
  );
};
