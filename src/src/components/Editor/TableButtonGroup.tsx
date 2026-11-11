import { Button, Stack } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import type { EditorBubbleMenuProps as EditorProps } from "./BubbleMenus/EditorBubbleMenu";

export const TableButtonGroup = ({ editor }: EditorProps) => {
  const { theme } = useThemeStore();

  return (
    <Stack
      direction="row"
      sx={{ backgroundColor: theme.palette.background.paper }}
    >
      <Button
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        {" "}
        Insert Table
      </Button>
    </Stack>
  );
};
