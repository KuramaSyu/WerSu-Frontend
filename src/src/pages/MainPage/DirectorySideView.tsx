import * as React from "react";
import { useDroppable } from "@dnd-kit/react";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import { ButtonBase, Stack, Typography, Skeleton, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";

interface DirectoryTreeNodeProps {
  item: HirarchyItem;
}

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
        <ButtonBase
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/d/${itemId}`);
          }}
          sx={{
            width: "100%",
            justifyContent: "flex-start",
            textAlign: "left",
            py: 0.5,
            px: 1,
            borderRadius: 1,
            color: "inherit",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={500}>
              {item.getName()}
            </Typography>
          </Stack>
        </ButtonBase>
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

  if (isLoading) {
    return (
      <Box sx={{ p: 1 }}>
        <Stack spacing={1}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Box key={i}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Skeleton variant="circular" width={24} height={24} animation="wave" />
                <Skeleton variant="text" width={`${60 - i * 6}%`} animation="wave" />
              </Box>
              <Box sx={{ pl: 3, mt: 0.5 }}>
                {Array.from({ length: 2 }).map((__, j) => (
                  <Box key={j} sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                    <Skeleton variant="circular" width={18} height={18} animation="wave" />
                    <Skeleton variant="text" width={`${50 - j * 12}%`} animation="wave" />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  const directoryHirarchy = new DirectoryHierarchyBuilder(
    directoriesById,
  ).build("Stacks");

  return (
    <SimpleTreeView defaultExpandedItems={[directoryHirarchy.getId()]}>
      <DirectoryTreeNode item={directoryHirarchy} />
    </SimpleTreeView>
  );
};
