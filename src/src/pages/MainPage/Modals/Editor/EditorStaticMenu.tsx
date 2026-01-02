import { Button, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { useState } from 'react';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikeThroughIcon from '@mui/icons-material/FormatStrikethrough';
import { useEditorState } from '@tiptap/react';
import { useThemeStore } from '../../../../zustand/useThemeStore';

export interface EditorBubbleMenuProps {
  editor: Editor;
}
export const EditorStaticMenu = ({ editor }: EditorBubbleMenuProps) => {
  const { isBold, isItalic, isStrikethrough } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive('bold'),
      isItalic: ctx.editor.isActive('italic'),
      isStrikethrough: ctx.editor.isActive('strike'),
    }),
  });
  const [formats, setFormats] = useState(() => {
    const initialFormats = [];
    if (isBold) initialFormats.push('bold');
    if (isItalic) initialFormats.push('italic');
    if (isStrikethrough) initialFormats.push('strike');
    return initialFormats;
  });
  const { theme } = useThemeStore();

  const handleFormat = (
    event: React.MouseEvent<HTMLElement>,
    newFormats: string[]
  ) => {
    setFormats(newFormats);
  };

  return (
    <Stack
      direction="row"
      sx={{ backgroundColor: theme.palette.background.paper }}
    >
      <ToggleButtonGroup
        value={formats}
        onChange={handleFormat}
        aria-label="text formatting"
        color={'secondary'}
      >
        <ToggleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          value="bold"
          aria-label="bold"
        >
          <FormatBoldIcon />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          value="italic"
          aria-label="italic"
        >
          <FormatItalicIcon />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          value="strike"
          aria-label="strike"
        >
          <StrikeThroughIcon />
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
};
