import { Box } from "@mui/material";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useEffect } from "react";
import { M1, M2 } from "../../../statics";
import { useEditorSettings } from "../../../zustand/useEditorSettings";

export function ImageNodeView({ node, selected, getPos }: NodeViewProps) {
  const { theme } = useThemeStore();
  const { editMode } = useEditorSettings();

  return (
    <NodeViewWrapper
      data-drag-handle
      contentEditable={false}
      className={selected ? "selected-image" : ""}
      style={
        {
          // display: "inline-block",
          // width fit-content:
        }
      }
    >
      <Box paddingY={M2} width={"fit-content"}>
        <Box
          component="img"
          src={node.attrs.src}
          alt={node.attrs.alt}
          sx={{
            display: "block",

            outline:
              selected && editMode
                ? `2px solid ${theme.palette.primary.main}`
                : "none",
            outlineOffset: "2px",
            transition: "outline 0.2s ease",
            borderRadius: 1,
          }}
        ></Box>
      </Box>
    </NodeViewWrapper>
  );
}
