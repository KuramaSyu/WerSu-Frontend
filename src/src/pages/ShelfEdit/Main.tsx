import { useCallback, useEffect } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { useShelf } from "../../api/queries/shelfQueries";
import { useLeftPanel, usePanelSize, useRightPanel } from "../../LayoutProvider";
import { ShelfEditPanel } from "./ShelfEditPanel";
import { ShelfTabs } from "./ShelfTabs";
import { ShelfWidthToggle } from "./ShelfWidthToggle";
import { isShelfTab, type ShelfTab } from "./shelfTabsModel";
import { useTopBarStore } from "../../zustand/useTopBarStore";

/** Stable id under which the shelf width toggle registers in the top bar. */
const SHELF_WIDTH_TOGGLE_SLOT_ID = "shelfWidth";
const SHELF_WIDTH_TOGGLE_ORDER = 100;

/**
 * Route entry for `/shelves/:shelfId`. Mounts the left rail anchor and
 * the main-object tabs (Settings / Rules / Permissions). The active tab
 * is kept in the `tab` search param so it survives refresh and can be
 * deep-linked.
 */
export const ShelfEditPage: React.FC = () => {
  const params = useParams<{ shelfId: string }>();
  const shelfId = params.shelfId ?? "";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: ShelfTab = isShelfTab(tabParam) ? tabParam : "settings";

  const shelfQuery = useShelf({ id: shelfId, include_books: false });

  usePanelSize({ left: "clamp(18rem, 22vw, 26rem)" });
  useRightPanel(null);

  // Publish the width toggle into the desktop top bar for this route.
  // The slot registry clears it on unmount, so it never leaks onto
  // other pages.
  const setSlot = useTopBarStore((s) => s.setSlot);
  const removeSlot = useTopBarStore((s) => s.removeSlot);
  useEffect(() => {
    setSlot(
      SHELF_WIDTH_TOGGLE_SLOT_ID,
      ShelfWidthToggle,
      SHELF_WIDTH_TOGGLE_ORDER,
    );
    return () => removeSlot(SHELF_WIDTH_TOGGLE_SLOT_ID);
  }, [setSlot, removeSlot]);
  useLeftPanel(
    <ShelfEditPanel
      shelf={shelfQuery.data ?? null}
      isLoading={shelfQuery.isLoading}
      onBack={() => navigate("/")}
    />,
    [shelfId, shelfQuery.data, shelfQuery.isLoading],
  );

  const handleTabChange = useCallback(
    (tab: ShelfTab) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  if (!shelfId) {
    return (
      <Stack
        sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}
        spacing={2}
      >
        <Alert severity="warning">No shelf selected.</Alert>
        <Button variant="outlined" onClick={() => navigate("/")}>
          Go home
        </Button>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {shelfQuery.data === undefined ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          {shelfQuery.isError ? (
            <Alert severity="error">
              {shelfQuery.error instanceof Error
                ? shelfQuery.error.message
                : "Failed to load shelf"}
            </Alert>
          ) : (
            <CircularProgress />
          )}
        </Box>
      ) : (
        <Box
          sx={{
            px: { xs: 2, md: 4 },
            py: 4,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ShelfTabs
            shelf={shelfQuery.data}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </Box>
      )}
    </Box>
  );
};

export interface ShelfTabRedirectProps {
  /** Tab to select on the canonical `/shelves/:shelfId` route. */
  tab: ShelfTab;
}

/**
 * Redirects the legacy `/shelves/:shelfId/edit` and
 * `/shelves/:shelfId/rules` routes to the canonical tabbed page.
 */
export const ShelfTabRedirect: React.FC<ShelfTabRedirectProps> = ({ tab }) => {
  const { shelfId } = useParams<{ shelfId: string }>();
  return <Navigate to={`/shelves/${shelfId}?tab=${tab}`} replace />;
};

export default ShelfEditPage;
