import type { KeyboardEvent } from "react";
import { InputBase, Paper, Typography } from "@mui/material";
import type { SlashCommandArgument } from "./slashCommandTypes";

export interface ArgumentChipProps {
  argument: SlashCommandArgument;
  value: string;
  focused: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onLabelClick: () => void;
}

/**
 * One slash-command argument: the argument name on a darker label segment
 * on the left, the value input on the theme's normal input background on
 * the right. Both segments sit flush inside one outlined `Paper`, so there
 * is no unstyled gap before the label.
 */
export const ArgumentChip = ({
  argument,
  value,
  focused,
  inputRef,
  onChange,
  onKeyDown,
  onFocus,
  onLabelClick,
}: ArgumentChipProps) => {
  return (
    <Paper
      component="span"
      variant="outlined"
      sx={{
        display: "inline-flex",
        alignItems: "stretch",
        overflow: "hidden",
        borderRadius: 1,
        bgcolor: "background.default",
        borderColor: focused ? "primary.main" : "divider",
        boxShadow: focused ? 1 : 0,
      }}
    >
      <Typography
        component="span"
        variant="caption"
        onClick={onLabelClick}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1,
          bgcolor: "action.selected",
          color: "text.secondary",
          fontWeight: 600,
          whiteSpace: "nowrap",
          cursor: "text",
          userSelect: "none",
        }}
      >
        {argument.name}
        {argument.required ? " *" : ""}
      </Typography>
      <InputBase
        inputRef={inputRef}
        value={value}
        placeholder={argument.defaultValue ?? "value"}
        inputProps={{
          "aria-label": argument.name,
          autoComplete: "off",
          spellCheck: false,
          // Inline style beats the editor surface's
          // `caret-color: transparent` rule regardless of stylesheet order.
          style: { caretColor: "currentColor" },
        }}
        onFocus={onFocus}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        sx={{
          minWidth: 128,
          bgcolor: "background.default",
          fontFamily: (theme) => theme.typography.fontFamily,
          color: "text.primary",
          "& .MuiInputBase-input": {
            px: 1,
            py: 0.5,
            fontSize: "0.8rem",
            color: "text.primary",
            // The editor surface sets `caret-color: transparent` for its
            // animated overlay caret; the argument input needs a real one.
            caretColor: "text.primary !important",
          },
          "& .MuiInputBase-input::placeholder": {
            color: "text.disabled",
            opacity: 1,
          },
        }}
      />
    </Paper>
  );
};

export default ArgumentChip;