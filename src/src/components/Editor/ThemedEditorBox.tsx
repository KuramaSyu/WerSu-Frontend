import { Box, darken, lighten, Paper, Popper, Typography } from "@mui/material";
import { M1, M2 } from "../../statics";
import { CodeBlockThemer } from "./CodeBlockThemer";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { latex } from "codemirror-lang-latex";
import { useThemeStore } from "../../zustand/useThemeStore";

export const ThemedEditorBox = ({
  children,
  editor,
}: {
  children: React.ReactNode;
  editor: Editor | null;
}) => {
  const { editMode } = useEditorSettings();
  const { theme } = useThemeStore();

  return (
    <Box
      sx={{
        //backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        //border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        // p: M2,
        my: theme.spacing(2), // spacing top and bottom
        mr: theme.spacing(2), // spacing right

        // Disable the border around the editor
        "& .ProseMirror": {
          outline: "none",
        },

        "& .tiptap": {
          // table header background
          "--gray-1": theme.palette.background.paper,
          "--gray-2": theme.palette.action.selected,
          // border of tables
          "--gray-3": theme.palette.divider,

          "--purple": theme.palette.primary.main,

          // give the outer table border the same thickness
          "& div[data-node-view-content-react]": {
            border: "1px solid var(--gray-3)",
          },

          "& th, & td": {
            border: "1px solid var(--gray-3)",
            padding: `0 ${M2}`,
          },

          "& th": {
            backgroundColor: "var(--gray-1)",
            fontWeight: 600,
          },

          "& code": {
            backgroundColor: theme.palette.background.paper,
            color: lighten(theme.palette.secondary.main, 0.2),
            padding: theme.spacing(0.25, 0.5),
            borderRadius: theme.shape.borderRadius,
          },

          // set background to latex box on hover
          "& .tiptap-mathematics-render": {
            position: "relative",
            // mb: 3,
            borderRadius: theme.shape.borderRadius,
            transition: `background-color ${theme.transitions.duration.standard}ms`,

            ...(editMode && {
              // marks the node with a background
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
                cursor: "pointer",
              },

              // renders tooltip with latex code
              "&:hover::after": {
                content: "attr(data-latex)",

                opacity: 1,
                // show the tooltop in the middle above
                position: "absolute",
                bottom: "100%",
                left: "50%",

                backgroundColor: theme.blendWithContrast(
                  theme.palette.background.paper,
                  0.2,
                ),
                borderRadius: theme.shape.borderRadius,

                // padding around the tooltip and margin between tooltip and math node
                padding: theme.spacing(0.5, 1),
                mb: theme.spacing(0.5),

                // keep in one line, small font and monospace
                whiteSpace: "nowrap",
                fontFamily: "monospace",
                fontSize: theme.typography.caption.fontSize,
              },
            }),
          },
        },
      }}
    >
      <CodeBlockThemer className="tiptap">{children}</CodeBlockThemer>
    </Box>
  );
};
