import { Box, type SxProps, type Theme } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export function MdxEditorMuiTheme({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  const theme = useTheme();

  return (
    <Box
      className={theme.palette.mode === 'dark' ? 'dark-theme' : undefined}
      sx={{
        /* =========================
           ACCENT (Primary actions)
           ========================= */
        '--accentBase': theme.palette.primary.light,
        '--accentBgSubtle': theme.palette.primary.light,
        '--accentBg': theme.palette.primary.light,
        '--accentBgHover': theme.palette.primary.main,
        '--accentBgActive': theme.palette.primary.dark,
        '--accentLine': theme.palette.primary.main,
        '--accentBorder': theme.palette.primary.main,
        '--accentBorderHover': theme.palette.primary.dark,
        '--accentSolid': theme.palette.primary.main,
        '--accentSolidHover': theme.palette.primary.dark,
        '--accentText': theme.palette.primary.main,
        '--accentTextContrast': theme.palette.primary.contrastText,

        /* =========================
           BASE (Surfaces / chrome)
           Toolbar, dialogs, menus
           ========================= */
        '--baseBase': theme.palette.background.paper,
        '--baseBgSubtle': theme.palette.background.paper,
        '--baseBg': theme.palette.background.paper,
        '--baseBgHover': theme.palette.action.hover,
        '--baseBgActive': theme.palette.action.selected,
        '--baseLine': theme.palette.divider,
        '--baseBorder': theme.palette.divider,
        '--baseBorderHover': theme.palette.text.secondary,
        '--baseSolid': theme.palette.grey[500],
        '--baseSolidHover': theme.palette.grey[600],
        '--baseText': theme.palette.text.primary,
        '--baseTextContrast': theme.palette.background.paper,

        /* =========================
           PAGE (Editor content area)
           ========================= */
        '--basePageBg': theme.palette.background.default,

        /* =========================
           ADMONITIONS
           ========================= */
        '--admonitionTipBg': theme.palette.info.light,
        '--admonitionTipBorder': theme.palette.info.main,

        '--admonitionInfoBg': theme.palette.success.light,
        '--admonitionInfoBorder': theme.palette.success.main,

        '--admonitionCautionBg': theme.palette.warning.light,
        '--admonitionCautionBorder': theme.palette.warning.main,

        '--admonitionDangerBg': theme.palette.error.light,
        '--admonitionDangerBorder': theme.palette.error.main,

        '--admonitionNoteBg': theme.palette.background.paper,
        '--admonitionNoteBorder': theme.palette.divider,

        /* =========================
           TYPOGRAPHY
           ========================= */
        fontFamily: theme.typography.fontFamily,
        // '--font-mono':
        //   theme.typography.fontFamilyMonospace ??
        //   'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',

        /* =========================
           TEXT / ROOT
           ========================= */
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.background.default,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
