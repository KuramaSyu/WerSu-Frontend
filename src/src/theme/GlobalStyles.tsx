import { GlobalStyles, useTheme } from '@mui/material';

export function EditorGlobalStyles() {
  const theme = useTheme();

  return (
    <GlobalStyles
      styles={{
        '.mdxeditor-popup-container': {
          zIndex: theme.zIndex.modal + 1,
        },
      }}
    />
  );
}
