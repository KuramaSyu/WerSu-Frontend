import { Box, Divider, Stack, Typography } from '@mui/material';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { CustomTheme } from '../../theme/customTheme';
import { M1 } from '../../statics';

export interface TitleProps {
  theme: CustomTheme;
  color1?: string;
  color2?: string;
}

export const Title: React.FC<TitleProps> = ({ theme, color1, color2 }) => {
  const { isMobile } = useBreakpoint();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        // fontFamily: NUMBER_FONT,
        fontWeight: 200,
        fontSize: 'inherit',
      }}
    >
      <Typography
        style={{
          color: color1 || theme.palette.primary.light,
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'inherit',
        }}
      >
        Wer{' '}
      </Typography>
      <Typography
        style={{
          color: color2 || theme.palette.secondary.light,
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'inherit',
        }}
      >
        Su{' '}
      </Typography>
      <Divider flexItem 
        orientation='vertical' 
        sx={{ 
          borderColor: theme.palette.primary.light,
          borderWidth: 1,
          height: '1em',
          alignSelf: 'center',
        }}></Divider>
      <Stack direction='column' spacing={0} sx={{justifyContent: 'center', alignItems: 'center', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', marginLeft: M1}}>
        <Typography
          style={{
            color: theme.palette.text.primary,
            fontSize: 'calc(1em / 3.5)',
            fontWeight: 'inherit',
            fontFamily: 'inherit',

          }}
        >
          Wer Sucht,
        </Typography>
        <Typography
          style={{
            color: theme.palette.text.secondary,
            fontSize: 'calc(1em / 3.5)',
            fontWeight: 'inherit',
            fontFamily: 'inherit',
          }}
        >
          Der Findet.
        </Typography>
      </Stack>
    </Box>
  );
};
