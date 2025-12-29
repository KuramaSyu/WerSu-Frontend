import { GlobalStyles } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { color } from 'framer-motion';

export default function TablePopoverStyles() {
  const theme = useTheme();

  return (
    <GlobalStyles
      styles={{
        // Target all table editor popovers
        '[class*="_tableColumnEditorPopoverContent_"], [class*="_tableRowEditorPopoverContent_"]':
          {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[4],
          },

        // Style toolbar buttons inside the popover
        '[class*="_tableColumnEditorPopoverContent_"] button, [class*="_tableRowEditorPopoverContent_"] button':
          {
            color: theme.palette.primary.main,
            backgroundColor: 'transparent',
            borderRadius: theme.shape.borderRadius,
            padding: theme.spacing(0.5),
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&[data-state="on"]': {
              backgroundColor: theme.palette.action.selected,
              color: theme.palette.primary.light,
            },
          },

        '[class*="_tableColumnEditorTrigger_"] button': {
          backgroundColor: theme.palette.muted.light,
          color: theme.palette.primary.main,
        },

        // Optional: popover arrow color
        '[class*="_popoverArrow_"] polygon': {
          fill: theme.palette.background.paper,
        },
      }}
    />
  );
}
