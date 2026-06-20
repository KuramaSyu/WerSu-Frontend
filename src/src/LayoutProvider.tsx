import { createContext, type ReactNode, useContext, useState } from "react";

type LayoutContextType = {
  leftPanel: ReactNode | null;
  rightPanel: ReactNode | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  setLeftPanel: (panel: ReactNode | null) => void;
  setRightPanel: (panel: ReactNode | null) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  showTopBar: boolean;
  setShowTopBar: (show: boolean) => void;
  clearPanels: () => void;
};

const LayoutContext = createContext<LayoutContextType | null>(null);

export interface AppLayoutProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<AppLayoutProps> = ({ children }) => {
  const [leftPanel, setLeftPanel] = useState<ReactNode | null>(null);
  const [rightPanel, setRightPanel] = useState<ReactNode | null>(null);

  // often in use for navigation and actions
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // usually not in use
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);

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
        setLeftPanel,
        setRightPanel,
        clearPanels,
        setLeftPanelOpen,
        setRightPanelOpen,
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
