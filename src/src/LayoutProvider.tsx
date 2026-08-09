import {
  createContext,
  type DependencyList,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useMediaQuery, useTheme } from "@mui/material";

type LayoutContextType = {
  leftPanel: ReactNode | null;
  rightPanel: ReactNode | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  // `true` after the user has interacted with the panel toggle.
  // While set, `usePanelSize`'s resize-driven auto-open/close is
  // suppressed so the user's choice persists across breakpoints; the
  // user can still freely toggle the panel themselves. `useLeftPanel`
  // / `useRightPanel` clear the override when the panel content
  // changes (e.g. route navigation).
  leftPanelUserOverride: boolean;
  rightPanelUserOverride: boolean;
  leftPanelSize: string;
  rightPanelSize: string;
  setLeftPanel: (panel: ReactNode | null) => void;
  setRightPanel: (panel: ReactNode | null) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setLeftPanelUserOverride: (override: boolean) => void;
  setRightPanelUserOverride: (override: boolean) => void;
  setLeftPanelSize: (size: string) => void;
  setRightPanelSize: (size: string) => void;
  // `true` while the top panel (WerSu wordmark + search bar) is
  // visible. The AppShell owns this state and flips it via the
  // scroll watchdog; the rails read it to slide their content up
  // (margin-top transition) when the top panel hides.
  showTopPanel: boolean;
  setShowTopPanel: (show: boolean) => void;
  clearPanels: () => void;
};

// Default open width of the left/right side panels when nothing else
// has been configured. Used as the initial LayoutProvider state —
// `usePanelSize` does not reset to this on unmount on purpose, see
// that hook for the reason.
export const DEFAULT_PANEL_SIZE = "280px";

const LayoutContext = createContext<LayoutContextType | null>(null);

export interface AppLayoutProps {
  children: ReactNode;
  // App-wide defaults for the open width of each side panel. Accept any
  // CSS length value, e.g. "280px", "10vw", "clamp(20rem, 25vw, 30rem)".
  // Components can still override these locally via `usePanelSize`.
  defaultLeftPanelSize?: string;
  defaultRightPanelSize?: string;
}

export const LayoutProvider: React.FC<AppLayoutProps> = ({
  children,
  defaultLeftPanelSize = DEFAULT_PANEL_SIZE,
  defaultRightPanelSize = DEFAULT_PANEL_SIZE,
}) => {
  const [leftPanel, setLeftPanel] = useState<ReactNode | null>(null);
  const [rightPanel, setRightPanel] = useState<ReactNode | null>(null);

  // often in use for navigation and actions
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // usually not in use
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // Tracks whether the user has explicitly toggled the panel since the
  // last content change. See `LayoutContextType.leftPanelUserOverride`.
  const [leftPanelUserOverride, setLeftPanelUserOverride] = useState(false);
  const [rightPanelUserOverride, setRightPanelUserOverride] = useState(false);
  const [showTopPanel, setShowTopPanel] = useState(true);
  const [leftPanelSize, setLeftPanelSize] = useState(defaultLeftPanelSize);
  const [rightPanelSize, setRightPanelSize] = useState(defaultRightPanelSize);

  const clearPanels = () => {
    setLeftPanel(null);
    setRightPanel(null);
  };

  return (
    <LayoutContext.Provider
      value={{
        leftPanel,
        rightPanel,
        leftPanelOpen,
        rightPanelOpen,
        leftPanelUserOverride,
        rightPanelUserOverride,
        leftPanelSize,
        rightPanelSize,
        setLeftPanel,
        setRightPanel,
        clearPanels,
        setLeftPanelOpen,
        setRightPanelOpen,
        setLeftPanelUserOverride,
        setRightPanelUserOverride,
        setLeftPanelSize,
        setRightPanelSize,
        showTopPanel,
        setShowTopPanel,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export function useLayout(): LayoutContextType {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within an AppLayout");
  }
  return context;
}

// Mount `panel` into the left side-panel on mount; clear it on unmount.
//
// Mount-only on purpose: the earlier `[panel]` dep forced callers to memoize
// the JSX they passed in (otherwise the effect would fire on every render
// and re-render the provider, creating an infinite loop). Route navigation
// in this app already remounts the routed page component, so a mount/unmount
// model swaps panels correctly without leaking that requirement to every
// caller.
//
// A new panel (mount or `deps` change) is treated as a fresh content
// surface: the user override is cleared and the panel opens by default.
// `usePanelSize({ openLeft })` may then auto-close below its breakpoint
// if the user has not toggled the panel since.
export function useLeftPanel(
  panel: ReactNode | null,
  deps: DependencyList = [],
): void {
  const { setLeftPanel, setLeftPanelOpen, setLeftPanelUserOverride } =
    useLayout();

  useEffect(() => {
    setLeftPanel(panel);
    setLeftPanelUserOverride(false);
    if (panel !== null) {
      setLeftPanelOpen(true);
    } else {
      setLeftPanelOpen(false);
    }
    // return () => {
    //   setLeftPanel(null);
    // };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Mount `panel` into the right side-panel on mount; clear it on unmount.
// See `useLeftPanel` for the rationale behind the mount-only contract.
//
// `deps` works the same way as in `useLeftPanel`: pass an optional array
// to re-set the panel when one of those values changes.
//
// A new panel is treated as a fresh content surface: the user override
// is cleared and the panel opens by default. `usePanelSize({ openRight })`
// may then auto-close below its breakpoint if the user has not toggled
// the panel since.
export function useRightPanel(
  panel: ReactNode | null,
  deps: DependencyList = [],
): void {
  const { setRightPanel, setRightPanelOpen, setRightPanelUserOverride } =
    useLayout();

  useEffect(() => {
    setRightPanel(panel);
    setRightPanelUserOverride(false);
    if (panel !== null) {
      setRightPanelOpen(true);
    } else {
      setRightPanelOpen(false);
    }
    // return () => {
    //   setRightPanel(null);
    // };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// MUI-aligned breakpoint tokens that `usePanelSize` accepts for its
// `openLeft` / `openRight` options. The same set is used by
// `useBreakpoint` for `isTablet` / `isDesktop` / `isXL`.
export type PanelOpenBreakpoint = "xs" | "sm" | "md" | "lg" | "xl";

export interface PanelSizeOptions {
  // Any CSS length value, e.g. "280px", "10vw", "clamp(20rem, 25vw, 30rem)".
  // Omitted sides keep their current size.
  left?: string;
  right?: string;
  // Minimum viewport breakpoint at which the panel auto-opens. Below the
  // breakpoint the panel is collapsed so the canvas stays wide on small
  // screens; the user can still toggle the panel via the TopBar. When
  // unset, the panel uses its existing open-on-mount behaviour (left
  // defaults open, right defaults closed).
  openLeft?: PanelOpenBreakpoint;
  openRight?: PanelOpenBreakpoint;
}

// Sets the open width of one or both side panels. Accepts any CSS
// length value (e.g. `"320px"`, `"10vw"`, `clamp(...)`). Runs in a
// layout effect so the first paint after navigation already reflects
// the new size; leaves the size alone on unmount so the AppShell's
// `grid-template-columns` transition animates straight from the old
// page's size to the new page's size instead of through
// `DEFAULT_PANEL_SIZE`.
//
// `openLeft` / `openRight` to show the panel when >= breakpoint and hide otherwise
export function usePanelSize(sizes: PanelSizeOptions): void {
  const {
    leftPanelSize,
    rightPanelSize,
    setLeftPanelSize,
    setRightPanelSize,
    setLeftPanelOpen,
    setRightPanelOpen,
    leftPanelUserOverride,
    rightPanelUserOverride,
  } = useLayout();
  const theme = useTheme();

  const { left, right, openLeft, openRight } = sizes;

  // `xs` means "open regardless of viewport" — query against a
  // degenerate min-width so `useMediaQuery` always returns `true`.
  // `undefined` means the side isn't being auto-driven — also use the
  // degenerate query so the hook order stays stable regardless of
  // which options the caller provides.
  const queryLeft =
    openLeft === "xs" || openLeft === undefined
      ? "(min-width: 0px)"
      : theme.breakpoints.up(openLeft);
  const queryRight =
    openRight === "xs" || openRight === undefined
      ? "(min-width: 0px)"
      : theme.breakpoints.up(openRight);
  const leftMatches = useMediaQuery(queryLeft);
  const rightMatches = useMediaQuery(queryRight);

  useLayoutEffect(() => {
    if (left !== undefined && left !== leftPanelSize) {
      setLeftPanelSize(left);
    }
    if (right !== undefined && right !== rightPanelSize) {
      setRightPanelSize(right);
    }
  }, [left, right]);

  // Drive the open state from the reactive media-query result. Runs in
  // a regular effect so it lands after `useLeftPanel`/`useRightPanel`'s
  // mount-default writes. Skips writes when the user has set an
  // override; the override is cleared by `useLeftPanel`/`useRightPanel`
  // each time the panel content changes, so the auto-default resumes
  // from the next render.
  useEffect(() => {
    if (openLeft !== undefined && !leftPanelUserOverride) {
      setLeftPanelOpen(leftMatches);
    }
  }, [openLeft, leftPanelUserOverride, leftMatches]);

  useEffect(() => {
    if (openRight !== undefined && !rightPanelUserOverride) {
      setRightPanelOpen(rightMatches);
    }
  }, [openRight, rightPanelUserOverride, rightMatches]);
}
