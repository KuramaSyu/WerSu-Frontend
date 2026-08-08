import { useBreakpoint } from "../../hooks/useBreakpoint";
import { DesktopTopBar } from "./DesktopTopBar";
import { MobileBottomBar } from "./MobileBottomBar";

/**
 * Picks the right top-bar chrome for the current viewport.
 *
 * Desktop (>= md): top-of-screen bar that slides off on scroll.
 * Mobile (< md): Discord-style bottom bar that's always visible.
 */
export const TopBar: React.FC = () => {
  const { isMobile } = useBreakpoint();
  return isMobile ? <MobileBottomBar /> : <DesktopTopBar />;
};
