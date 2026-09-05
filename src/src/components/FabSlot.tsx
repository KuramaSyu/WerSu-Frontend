import React from "react";
import { Grow, Stack } from "@mui/material";
import { TransitionGroup } from "react-transition-group";
import { useThemeStore } from "../zustand/useThemeStore";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { MOBILE_BOTTOM_BAR_CLEARANCE } from "../statics";

export interface FabSlotProps {
  // FABs to anchor at the bottom-right of the viewport. Each
  // child must be a single React element for the Grow wrap.
  children: React.ReactElement | React.ReactElement[];
}

/**
 * Bottom-right anchor for floating action buttons.
 *
 * Owns positioning and z-index; children stay content-only.
 * Wraps each child in TransitionGroup + Grow so add/remove
 * animates in. React key changes drive the transition.
 */
export const FabSlot: React.FC<FabSlotProps> = ({ children }) => {
  const { theme } = useThemeStore();
  const { isMobile } = useBreakpoint();

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        position: "fixed",
        right: theme.spacing(2),
        // Lift the FAB stack above the mobile bottom bar so
        // the buttons stay reachable.
        bottom: isMobile
          ? `calc(${theme.spacing(2)} + ${MOBILE_BOTTOM_BAR_CLEARANCE})`
          : theme.spacing(2),
        zIndex: (theme) => theme.zIndex.appBar + 2,
      }}
    >
      <TransitionGroup component={React.Fragment}>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) {
            return null;
          }
          // Span host element gives Grow a DOM ref; FABs are
          // function components that do not forward refs.
          return (
            <Grow
              key={child.key ?? undefined}
              timeout={{
                enter: theme.transitions.duration.complex,
                exit: 0,
              }}
            >
              <span style={{ display: "inline-flex" }}>{child}</span>
            </Grow>
          );
        })}
      </TransitionGroup>
    </Stack>
  );
};

export default FabSlot;
