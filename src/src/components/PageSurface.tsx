import type { ReactNode, Ref } from "react";
import { Box, Stack } from "@mui/material";
import { M2, M3, M4 } from "../statics";
import TranslucentPaper from "./TranslucentPaper";

export interface PageSurfaceProps {
  /** Main page content rendered on the translucent sheet. */
  children: ReactNode;
  /** Optional floating content (dialogs, FABs) kept outside the sheet. */
  overlay?: ReactNode;
  /** Ref for the page's scroll container. */
  containerRef?: Ref<HTMLDivElement>;
}

/**
 * Shared page scaffold used by content pages such as the directory and
 * tag views.
 *
 * The outer Box owns positioning and scrolling; the inner
 * `TranslucentPaper` gives the heading, breadcrumbs and body one common
 * translucent surface instead of stacking several opaque panels.
 */
export const PageSurface: React.FC<PageSurfaceProps> = ({
  children,
  overlay,
  containerRef,
}) => {
  return (
    // This would be a paper with elevation=0, but that breaks the
    // translucent effect -> use the app background at elevation=0 and
    // paint the actual surface on the inner TranslucentPaper.
    <Box
      ref={containerRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        // Fill the AppShell main content box exactly; any overflow is
        // handed to that box's overflowY: auto so the page scrolls.
        height: "100%",
        width: `clamp(20rem, 100%, 90rem)`,
        maxWidth: "100%",
        minWidth: 0,
        alignSelf: "center",
        // The AppShell outlet only pads partially.
        pr: M3,
        pt: M2,
        // The app has no global border-box reset, so under the default
        // `content-box` this `width: 100%` + padding would render wider
        // than the scroll container and make the page scroll on the X
        // axis. Keep the padding inside the width.
        boxSizing: "border-box",
      }}
    >
      <Stack direction="row" spacing={M4} sx={{ alignItems: "stretch" }}>
        <TranslucentPaper
          elevation={0}
          sx={{
            flex: 1,
            minWidth: 0,
            maxWidth: "100%",
            p: M3,
            borderRadius: (theme) => theme.shape.borderRadius,
          }}
        >
          {children}
        </TranslucentPaper>
      </Stack>
      {overlay}
    </Box>
  );
};

export default PageSurface;
