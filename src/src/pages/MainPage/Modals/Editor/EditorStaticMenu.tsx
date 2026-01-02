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
import { BoldItalicMenu } from './BoldItalicMenu';
import { TableButtonGroup } from './TableButtonGroup';

export interface EditorBubbleMenuProps {
  editor: Editor;
}
export const EditorStaticMenu = ({ editor }: EditorBubbleMenuProps) => {
  return (
    <Stack direction="row">
      <BoldItalicMenu editor={editor} />
      <TableButtonGroup editor={editor} />
    </Stack>
  );
};
