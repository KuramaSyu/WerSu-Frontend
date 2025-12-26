import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '../../../zustand/useThemeStore';
import { M1, M2, M3, M4 } from '../../../statics';
import {
  MenuButtonAddTable,
  MenuButtonBold,
  MenuButtonBulletedList,
  MenuButtonCode,
  MenuButtonCodeBlock,
  MenuButtonItalic,
  MenuButtonOrderedList,
  MenuButtonTaskList,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  RichTextEditor,
  TableBubbleMenu,
  type RichTextEditorRef,
} from 'mui-tiptap';
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table';
interface NoteEditorModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onSave: (content: string) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  open,
  onClose,
  title,
  content,
  onSave,
}) => {
  const { theme } = useThemeStore();
  const rteRef = useRef<RichTextEditorRef>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      sx={{ color: theme.palette.text.primary }}
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.palette.background.paper,
          padding: M2,
        }}
      >
        {title}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          backgroundColor: theme.palette.background.default,
          padding: M3,
          minHeight: '40vh',
          display: 'flex',
        }}
      >
        <RichTextEditor
          ref={rteRef}
          sx={{ height: '100%', width: '100%', mt: M3 }}
          extensions={[
            StarterKit,
            Table.configure({
              resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
          ]}
          content={content}
          renderControls={() => (
            <MenuControlsContainer>
              <MenuSelectHeading />
              <MenuDivider />
              <MenuButtonBold />
              <MenuButtonItalic />
              <MenuButtonCodeBlock />
              <MenuButtonBulletedList />
              <MenuButtonOrderedList />
              {/* <MenuButtonTaskList /> */}
              <MenuButtonAddTable />
            </MenuControlsContainer>
          )}
        >
          {() => (
            <>
              <TableBubbleMenu />
            </>
          )}
        </RichTextEditor>
      </DialogContent>
    </Dialog>
  );
};
