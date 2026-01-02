import { Button, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEffect, useState } from 'react';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikeThroughIcon from '@mui/icons-material/FormatStrikethrough';
import { useEditorState } from '@tiptap/react';
import { useThemeStore } from '../../../../zustand/useThemeStore';
import type { EditorBubbleMenuProps as EditorProps } from './EditorBubbleMenu';

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
        {' '}
        Insert Table
      </Button>
    </Stack>
  );
};
