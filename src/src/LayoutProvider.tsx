import { createContext, type ReactNode, useContext, useState } from "react";

type LayoutContextType = {
  leftPanel: ReactNode | null;
  rightPanel: ReactNode | null;
  setLeftPanel: (panel: ReactNode | null) => void;
  setRightPanel: (panel: ReactNode | null) => void;
  clearPanels: () => void;
};

const LayoutContext = createContext<LayoutContextType | null>(null);

export interface AppLayoutProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<AppLayoutProps> = ({ children }) => {
  const [leftPanel, setLeftPanel] = useState<ReactNode | null>(null);
  const [rightPanel, setRightPanel] = useState<ReactNode | null>(null);

  const clearPanels = () => {
    setLeftPanel(null);
    setRightPanel(null);
  };

  return (
    <LayoutContext.Provider
      value={{
        leftPanel,
        rightPanel,
        setLeftPanel,
        setRightPanel,
        clearPanels,
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
