import { Box, InputAdornment, Stack, TextField } from '@mui/material';
import { useThemeStore } from '../../zustand/useThemeStore';
import SearchIcon from '@mui/icons-material/Search';

import { Logo } from '../../components/logo';

export const MainPage: React.FC = () => {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Box
        sx={{
          height: '33%',
          minWidth: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          justifyItems: 'center',
          display: 'flex',
        }}
      >
        <Stack
          component="div"
          direction="row"
          spacing={8}
          alignItems="center"
          width="100%"
          height="100%"
          sx={{ backgroundColor: theme.palette.background.paper, padding: 16 }}
        >
          <Box>
            <Logo
              style={{ width: '300px', height: '300px' }}
              monochrome={false}
            />
          </Box>
          <TextField
            fullWidth
            placeholder="Search for anything..."
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '2.5rem' }} />
                </InputAdornment>
              ),
              sx: {
                // "BIG"
                fontSize: '2rem',
                // "Properly Rounded"
                borderRadius: '50px',
                // Adjust internal padding for height
                '& .MuiOutlinedInput-input': {
                  padding: '18px 0',
                },
              },
            }}
          />
        </Stack>
      </Box>
    </div>
  );
};
