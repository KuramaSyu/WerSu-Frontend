import * as React from "react";
import { useDroppable } from "@dnd-kit/react";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
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
      label={item.getName()}
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

export const DirectorySideView: React.FC = () => {
  const { directoriesById } = useDirectoryStore();
  const directoryHirarchy = new DirectoryHierarchyBuilder(
    directoriesById,
  ).build("Stacks");

  return (
    <SimpleTreeView defaultExpandedItems={[directoryHirarchy.getId()]}>
      <DirectoryTreeNode item={directoryHirarchy} />
    </SimpleTreeView>
  );
};
