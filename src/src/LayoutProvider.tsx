import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type LayoutContextType = {
  leftPanel: ReactNode | null;
  rightPanel: ReactNode | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftPanelSize: string;
  rightPanelSize: string;
  setLeftPanel: (panel: ReactNode | null) => void;
  setRightPanel: (panel: ReactNode | null) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setLeftPanelSize: (size: string) => void;
  setRightPanelSize: (size: string) => void;
  showTopBar: boolean;
  setShowTopBar: (show: boolean) => void;
  clearPanels: () => void;
};

// Default open width of the left/right side panels when nothing else
// has been configured. Used as the fall-through value for
// `usePanelSize` cleanups and as the initial LayoutProvider state.
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
  const [showTopBar, setShowTopBar] = useState(true);
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
        leftPanelSize,
        rightPanelSize,
        setLeftPanel,
        setRightPanel,
        clearPanels,
        setLeftPanelOpen,
        setRightPanelOpen,
        setLeftPanelSize,
        setRightPanelSize,
        showTopBar,
        setShowTopBar,
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
export function useLeftPanel(panel: ReactNode | null): void {
  const { setLeftPanel, setLeftPanelOpen } = useLayout();

  useEffect(() => {
    setLeftPanel(panel);
    if (panel !== null) {
      setLeftPanelOpen(true);
    } else {
      setLeftPanelOpen(false);
    }
    // return () => {
    //   setLeftPanel(null);
    // };
  }, []);
}

// Mount `panel` into the right side-panel on mount; clear it on unmount.
// See `useLeftPanel` for the rationale behind the mount-only contract.
export function useRightPanel(panel: ReactNode | null): void {
  const { setRightPanel, setRightPanelOpen } = useLayout();

  useEffect(() => {
    setRightPanel(panel);
    if (panel !== null) {
      setRightPanelOpen(true);
    } else {
      setRightPanelOpen(false);
    }
    // return () => {
    //   setRightPanel(null);
    // };
  }, []);
}

export interface PanelSizeOptions {
  // Any CSS length value, e.g. "280px", "10vw", "clamp(20rem, 25vw, 30rem)".
  // Omitted sides keep their current size.
  left?: string;
  right?: string;
}

// Set the open width of one or both side panels for the lifetime of the
// calling component. Accepts any CSS length value, so callers can pin
// the width (e.g. "320px"), make it responsive (e.g. "10vw"), or bound
// it with `clamp(...)`. On unmount, the sides this hook touched fall
// back to the LayoutProvider defaults.
export function usePanelSize(sizes: PanelSizeOptions): void {
  const { leftPanelSize, rightPanelSize, setLeftPanelSize, setRightPanelSize } =
    useLayout();

  const { left, right } = sizes;

  useEffect(() => {
    if (left !== undefined && left !== leftPanelSize) {
      setLeftPanelSize(left);
    }
    if (right !== undefined && right !== rightPanelSize) {
      setRightPanelSize(right);
    }
    return () => {
      if (left !== undefined) {
        setLeftPanelSize(DEFAULT_PANEL_SIZE);
      }
      if (right !== undefined) {
        setRightPanelSize(DEFAULT_PANEL_SIZE);
      }
    };
  }, [left, right]);
}
