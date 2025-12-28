import type { Theme } from '@mui/material/styles';

export const mdxeditorRootClass = 'mdxeditor-mui';

export const buildMdxeditorCssVars = (theme: Theme) => ({
  '--baseBg': theme.palette.background.paper,
  '--baseText': theme.palette.text.primary,
  '--accentBg': theme.palette.primary.light,
  '--accentSolid': theme.palette.primary.main,
  '--accentTextContrast': theme.palette.primary.contrastText,
  '--borderSubtle': theme.palette.divider,
  '--shadowColor': 'rgba(0,0,0,0.2)',
  '--font-sans': theme.typography.fontFamily,
  '--font-mono':
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
});
