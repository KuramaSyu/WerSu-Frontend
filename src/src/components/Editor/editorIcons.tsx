// Single map from an icon name to a rendered icon.
//
// Bubble-menu ops and right-click table commands both carry icon names
// (strings, so the pure strategy layer stays free of JSX). This module
// is the one place those names are resolved, so the two surfaces can
// never disagree on which glyph a command uses.

import type { ReactNode } from "react";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikeThroughIcon from "@mui/icons-material/FormatStrikethrough";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import CodeIcon from "@mui/icons-material/Code";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTableOff,
  IconTransitionBottom,
  IconTransitionLeft,
  IconTransitionRight,
  IconTransitionTop,
} from "@tabler/icons-react";

export function iconForName(name: string): ReactNode {
  switch (name) {
    case "format-bold":
      return <FormatBoldIcon fontSize="small" />;
    case "format-italic":
      return <FormatItalicIcon fontSize="small" />;
    case "format-strikethrough":
      return <StrikeThroughIcon fontSize="small" />;
    case "format-clear":
      return <FormatClearIcon fontSize="small" />;
    case "code":
      return <CodeIcon fontSize="small" />;
    case "highlight":
      return <BorderColorIcon fontSize="small" />;
    case "row-insert-top":
      return <IconRowInsertTop size={18} />;
    case "row-insert-bottom":
      return <IconRowInsertBottom size={18} />;
    case "row-remove":
      return <IconRowRemove size={18} />;
    case "row-move-up":
      return <IconTransitionTop size={18} />;
    case "row-move-down":
      return <IconTransitionBottom size={18} />;
    case "column-insert-left":
      return <IconColumnInsertLeft size={18} />;
    case "column-insert-right":
      return <IconColumnInsertRight size={18} />;
    case "column-remove":
      return <IconColumnRemove size={18} />;
    case "column-move-left":
      return <IconTransitionLeft size={18} />;
    case "column-move-right":
      return <IconTransitionRight size={18} />;
    case "table-remove":
      return <IconTableOff size={18} />;
    // Typo fallback renders a neutral icon instead of nothing.
    default:
      return <FormatClearIcon fontSize="small" />;
  }
}
