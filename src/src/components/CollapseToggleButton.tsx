// AnimatedToggleButton.jsx
import React from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import ToggleButton from "@mui/material/ToggleButton";

/**
 * A ToggleButton that animates extra content (e.g. a label) in/out of view
 * when selected, using MUI's Collapse (horizontal) under the hood.
 *
 * Works as a drop-in replacement for ToggleButton inside a
 * ToggleButtonGroup — the group still injects  `value`,
 * `onChange`, etc. as usual; this component just forwards them.
 * `replaceChildren` is an optional prop to replce children with `whenSelected` if `selected` is true.
 *
 * Example:
 * ```tsx
 * <CollapseToggleButton
 *   value="myValue"
 *   whenSelected={<Typography>My Label</Typography>}
 *   selected={selectedValue === "myValue"}
 * >
 *   <MyIcon />
 * </CollapseToggleButton>
 * ```
 */
const CollapseToggleButton = React.forwardRef<
  HTMLButtonElement,
  {
    replaceChildren?: boolean;
    children: React.ReactNode;
    whenSelected?: React.ReactNode;
    selected?: boolean;
    timeout?: number;
    gap?: number;
    sx?: any;
    value?: any;
    [key: string]: any;
  }
>(function CollapseToggleButton(
  {
    replaceChildren = false,
    children,
    whenSelected,
    selected,
    timeout = 200,
    gap = 1,
    sx,
    value,
    ...props
  },
  ref,
) {
  return (
    <ToggleButton
      ref={ref}
      value={value || ""}
      selected={selected}
      sx={{ gap: 0, ...sx }}
      {...props}
    >
      {replaceChildren ? (
        <Collapse
          orientation="horizontal"
          in={!selected}
          timeout={timeout}
          unmountOnExit
        >
          <Box sx={{ display: "inline-flex" }}>{children}</Box>
        </Collapse>
      ) : (
        children
      )}

      {whenSelected && (
        <Collapse orientation="horizontal" in={!!selected} timeout={timeout}>
          <Box sx={{ whiteSpace: "nowrap", pl: gap }}>{whenSelected}</Box>
        </Collapse>
      )}
    </ToggleButton>
  );
});

export default CollapseToggleButton;
