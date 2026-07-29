import {
  alpha,
  Box,
  darken,
  lighten,
  Paper,
  Popper,
  Typography,
} from "@mui/material";
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

          // links
          "& a": {
            color: alpha(theme.palette.primary.light, 0.85),
            fontWeight: 500,
            textDecoration: "underline",
            textDecorationColor: alpha(theme.palette.primary.light, 0.85),
            textUnderlineOffset: "0.15em",
          },
          "& a:hover": {
            color: theme.palette.primary.light,
            textDecorationColor: theme.palette.primary.light,
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
                transform: "translateX(-50%)",

                backgroundColor: theme.blendWithContrast(
                  theme.palette.background.paper,
                  0.2,
                  undefined,
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

          // <details> collapsible block; themed animations use theme transition tokens.
          '& [data-type="details"]': {
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "baseline",
            px: 1,
            py: 0.5,
            mr: 1,
            mb: 1,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
          },

          // <details>  Node view inserts a wrapper div around the summary; hide it.
          '& [data-type="details"] > div': {
            display: "contents",
          },

          // <details> Chevron toggle button.
          "& .details-toggle": {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.5rem",
            height: "1.5rem",
            marginRight: 0.5,
            padding: 0,
            border: 0,
            background: "transparent",
            color: "inherit",

            userSelect: "none",
            flexShrink: 0,
            transform: "rotate(0deg)",
            transformOrigin: "center",
            willChange: "transform",
            transition: theme.transitions.create(["transform"]),
          },

          // rotate <details> chevron when open
          '& [data-type="details"][class~="is-open"] .details-toggle': {
            transform: "rotate(180deg)",
          },

          // <details> Summary header — bold + flex so chevron and text align.
          "& summary": {
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
          },

          // <details> Body: animate max-height; override [hidden] so element stays in layout.
          '& [data-type="detailsContent"]': {
            display: "block",
            maxHeight: 0,
            overflow: "hidden",
            flexBasis: "100%",
            paddingLeft: `calc(1.5rem + ${theme.spacing(0.25)})`, // padding for chevron
            transition: theme.transitions.create(["all"], {
              duration: theme.transitions.duration.shortest,
            }),
          },

          // <details> Open: expand to a generous fixed max-height.
          '& [data-type="details"][class~="is-open"] [data-type="detailsContent"]':
            {
              mt: 1,
              maxHeight: "5000px", // without it it wouldnt open at all
            },

          // <details> SVG icon inside the chevron button.
          "& .details-toggle-icon": {
            cursor: "pointer",
            width: "100%",
            height: "100%",
            fill: "currentColor",
          },
        },
      }}
    >
      <CodeBlockThemer className="tiptap">{children}</CodeBlockThemer>
    </Box>
  );
};
