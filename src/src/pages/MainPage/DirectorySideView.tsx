import { Card, Stack } from "@mui/material";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import * as React from "react";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import {
  DirectoryHierarchyBuilder,
  NoteHierarchyBuilder,
  RootHirarchyItem,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import { useNotesStore } from "../../zustand/useNotesStore";

export const DirectorySideView: React.FC = () => {
  const { directoriesById } = useDirectoryStore();
  const {} = useNotesStore();
  const bg = null;

  const directoryHirarchy = new DirectoryHierarchyBuilder(
    directoriesById,
  ).build("Stacks");

  /**
   * recursively generates tree items for a given hierarchy item and its children
   * @param item the root item to construct subitems for
   */
  const generateTreeItems = (item: HirarchyItem): React.ReactNode => {
    return (
      <TreeItem
        key={item.getId()}
        itemId={item.getId()}
        label={item.getName()}
        sx={{
          "& > .MuiTreeItem-content": {
            minHeight: 50,
            borderRadius: 1,
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
        {item.getChildren().map((child) => generateTreeItems(child))}
      </TreeItem>
    );
  };

  return (
    <SimpleTreeView defaultExpandedItems={[directoryHirarchy.getId()]}>
      {generateTreeItems(directoryHirarchy)}
    </SimpleTreeView>
  );
};
