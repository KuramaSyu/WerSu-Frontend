import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useThemeStore } from './zustand/useThemeStore';

import './App.css';
import { MainPage } from './pages/MainPage/Main';
import { Box } from '@mui/material';

function App() {
  const { theme } = useThemeStore();
  const [count, setCount] = useState(0);

  return (
    <ThemeProvider theme={theme}>
      {/* <CssBaseline /> */}
      <Router>
        <Box
          sx={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden', // Prevents content from growing beyond 100vh
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Routes>
            <Route path="/" element={<MainPage />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
