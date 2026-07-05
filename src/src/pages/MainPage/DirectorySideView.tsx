import * as React from "react";
import { useDroppable } from "@dnd-kit/react";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import {
  ButtonBase,
  Stack,
  Typography,
  Skeleton,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";

interface DirectoryTreeNodeProps {
  item: HirarchyItem;
}

/**
 * Resolves the path from the root of a hierarchy to the node with the given id.
 *
 * Returns an empty array when the id is not present in the tree.
 */
const findPathById = (root: HirarchyItem, id: string): HirarchyItem[] => {
  if (root.getId() === id) {
    return [root];
  }

  for (const child of root.getChildren()) {
    const path = findPathById(child, id);
    if (path.length > 0) {
      return [root, ...path];
    }
  }

  return [];
};

/**
 * Extracts the current directory id from a URL pathname.
 *
 * Matches `/d/:id` and `/d/:id/<anything>` (e.g. `/d/:id/edit`) so the same
 * directory stays highlighted on its edit sub-route. Returns null for any
 * other path, so unrelated routes (e.g. `/n/:id`) never accidentally
 * highlight a directory.
 */
const getDirectoryIdFromPath = (pathname: string): string | null => {
  const match = pathname.match(/^\/d\/([^/]+)(?:\/.*)?$/);
  return match ? match[1] : null;
};

/**
 * Recursive tree node that registers each directory item as a dnd-kit
 * droppable target.
 */
const DirectoryTreeNode: React.FC<DirectoryTreeNodeProps> = ({ item }) => {
  const navigate = useNavigate();
  const itemId = item.getId();
  const { ref, isDropTarget } = useDroppable({
    id: itemId,
    type: "directory",
    accept: "note",
    data: {
      directoryId: itemId,
      directoryName: item.getName(),
    },
  });
  const bg = null;

  return (
    <TreeItem
      key={itemId}
      itemId={itemId}
      ref={ref}
      label={
        <Stack
          direction="row"
          spacing={1}
          sx={{ pr: 0.5, alignItems: "center" }}
        >
          <ButtonBase
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/d/${itemId}`);
            }}
            sx={{
              flex: 1,
              justifyContent: "flex-start",
              textAlign: "left",
              py: 0.5,
              px: 1,
              borderRadius: 1,
              color: "inherit",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
              }}
            >
              <Typography variant="body2">{item.getName()}</Typography>
            </Stack>
          </ButtonBase>
          {itemId !== "root" && (
            <Tooltip title="Edit directory">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/d/${itemId}/edit`);
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      }
      sx={{
        "& > .MuiTreeItem-content": {
          minHeight: 50,
          borderRadius: 1,
          outline: isDropTarget ? "2px dashed rgba(255,255,255,0.7)" : "none",
          outlineOffset: isDropTarget ? "-2px" : "0px",
          backgroundImage: bg
            ? "linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url(" +
              bg +
              ")"
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: bg ? "#fff" : "inherit",
        },
        "& > .MuiTreeItem-content.Mui-selected": {
          backgroundColor: "rgba(255,255,255,0.18)",
        },
      }}
    >
      {item.getChildren().map((child) => (
        <DirectoryTreeNode key={child.getId()} item={child} />
      ))}
    </TreeItem>
  );
};

export const DirectorySideView: React.FC<{ isLoading?: boolean }> = ({
  isLoading = false,
}) => {
  const { directoriesById } = useDirectoryStore();
  const location = useLocation();

  // Pull the active directory id from the URL so the tree highlights the
  // row the user is actually viewing, even after a refresh or deep-link.
  const currentDirectoryId = React.useMemo(
    () => getDirectoryIdFromPath(location.pathname),
    [location.pathname],
  );

  const directoryHirarchy = React.useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  // Auto-expand the path to the selected directory so the highlighted row
  // is visible even when nested deep. The set is re-applied on every
  // navigation by keying the tree on the active directory id below.
  const defaultExpandedItems = React.useMemo(() => {
    const ids = new Set<string>([directoryHirarchy.getId()]);
    if (currentDirectoryId) {
      const path = findPathById(directoryHirarchy, currentDirectoryId);
      for (const node of path) {
        ids.add(node.getId());
      }
    }
    return Array.from(ids);
  }, [directoryHirarchy, currentDirectoryId]);

  if (isLoading) {
    return (
      <Box sx={{ p: 1 }}>
        <Stack spacing={1}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Box key={i}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Skeleton
                  variant="circular"
                  width={24}
                  height={24}
                  animation="wave"
                />
                <Skeleton
                  variant="text"
                  width={`${60 - i * 6}%`}
                  animation="wave"
                />
              </Box>
              <Box sx={{ pl: 3, mt: 0.5 }}>
                {Array.from({ length: 2 }).map((__, j) => (
                  <Box
                    key={j}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    <Skeleton
                      variant="circular"
                      width={18}
                      height={18}
                      animation="wave"
                    />
                    <Skeleton
                      variant="text"
                      width={`${50 - j * 12}%`}
                      animation="wave"
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <SimpleTreeView
      // Keying on the active directory remounts the tree on navigation so
      // the auto-expanded path is reapplied to the freshly-mounted tree.
      key={currentDirectoryId ?? "none"}
      defaultExpandedItems={defaultExpandedItems}
      selectedItems={currentDirectoryId}
    >
      <DirectoryTreeNode item={directoryHirarchy} />
    </SimpleTreeView>
  );
};
