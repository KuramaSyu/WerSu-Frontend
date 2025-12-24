import { alpha, Box, darken, SvgIcon } from '@mui/material';
import { useLoadingStore } from '../../zustand/loadingStore';
import React, { useEffect } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import BlockIcon from '@mui/icons-material/Block';
import Fade from '@mui/material/Fade';
import { useThemeStore } from '../../zustand/useThemeStore';
import { ThemeProvider } from '@emotion/react';
import {
  ExpandingCircleBackground,
  StaticCircleBackground,
} from './CircleBackground';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Title } from './Title';
import { useMinSquareSize } from './minSquareSize';
import { defaultTheme } from '../../zustand/defaultTheme';

interface LogoSvgComponentProps {
  style?: React.CSSProperties;
  monochrome?: boolean; // add monochrome flag
}

export const LogoSvgComponent: React.FC<LogoSvgComponentProps> = ({
  style,
  monochrome = false, // default to false
}) => {
  const { theme } = useThemeStore(); // get current theme

  // If monochrome, apply greyscale and color filter
  const filterStyle = monochrome
    ? {
        filter: `grayscale(1) brightness(1.1) drop-shadow(0 0 0 ${theme.palette.primary.main})`,
      }
    : {};

  return (
    <img
      src="/assets/GoToHell-Icon.svg"
      alt="GoToHell Logo"
      style={{
        width: '100%',
        height: '100%',
        ...(style || {}),
        ...filterStyle,
      }}
    />
  );
};

export const SmallLogoSvgComponent: React.FC<LogoSvgComponentProps> = ({
  style,
  monochrome = false, // default to false
}) => {
  const { theme } = useThemeStore(); // get current theme

  // If monochrome, apply greyscale and color filter
  const filterStyle = monochrome
    ? {
        filter: `grayscale(1) brightness(1.1) drop-shadow(0 0 0 ${theme.palette.primary.main})`,
      }
    : {};

  return (
    <img
      src="/assets/GoToHell-Icon-small.svg"
      alt="GoToHell Logo"
      style={{
        width: '100%',
        height: '100%',
        ...(style || {}),
        ...filterStyle,
      }}
    />
  );
};

interface LoadingMapValue {
  loaded: boolean;
  time: number;
}

const LoadingStatus = {
  Loading: 'loading',
  Success: 'success',
  Error: 'error',
  Skipped: 'skipped',
} as const;

class LoadingComponent {
  loaded: boolean;
  time: number;
  status: typeof LoadingStatus[keyof typeof LoadingStatus];

  constructor(loaded: boolean, time: number, status?: typeof LoadingStatus[keyof typeof LoadingStatus]) {
    this.loaded = loaded;
    this.time = time;
    this.status =
      status !== undefined
        ? status
        : loaded
        ? LoadingStatus.Success
        : LoadingStatus.Loading;
  }

  setStatus(status: typeof LoadingStatus[keyof typeof LoadingStatus]) {
    this.status = status;
    this.loaded = status === LoadingStatus.Success;
  }
}

export const LoadingPage: React.FC = () => {
  const [startTime, setStartTime] = React.useState(Date.now());
  const { isLoading, setLoading } = useLoadingStore();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const size = useMinSquareSize(containerRef);
  const MIN_STARTUP_TIME = 750;
  const MIN_STARTUP_TIME_S = MIN_STARTUP_TIME / 1000;
  const initialLoadingMap = new Map<string, LoadingComponent>([
    ['You', new LoadingComponent(false, 0)],
  ]);
  const [loadingMap, setLoadingMap] = React.useState(initialLoadingMap);
  const { isMobile } = useBreakpoint();

  // Initialize theme
  useEffect(() => {
    const startTime = Date.now();

    setLoadingMap((prev) => {
            const comp = prev.get('Theme');
            if (comp) {
              comp.loaded = true;
              comp.time = Date.now() - startTime;
              comp.setStatus(LoadingStatus.Success);
              prev.set('Theme', comp);
            }
            return new Map(prev);
          });
  }, []);

  // set isLoading to false, when everthing is initialized
  useEffect(() => {
    const allLoaded = Array.from(loadingMap.values())
      .map(
        (v) =>
          v.status === LoadingStatus.Success ||
          v.status === LoadingStatus.Skipped ||
          v.status === LoadingStatus.Error
      )
      .every((loaded) => loaded === true);
    if (allLoaded) {
      const elapsedTime = Date.now() - startTime;
      setTimeout(() => {
        setLoading(false);
      }, Math.max(MIN_STARTUP_TIME - elapsedTime, 125));
    }
  }, [loadingMap]);

  // load Api requirements
  useEffect(() => {
    const init = async () => {}
     
    }, []);

  const getStatusIcon = (status: typeof LoadingStatus[keyof typeof LoadingStatus]) => {
    switch (status) {
      case LoadingStatus.Success:
        return (
          <CheckCircleIcon sx={{ color: defaultTheme.palette.success.main }} />
        );
      case LoadingStatus.Error:
        return <ErrorIcon sx={{ color: defaultTheme.palette.error.main }} />;
      case LoadingStatus.Skipped:
        return (
          <BlockIcon sx={{ color: defaultTheme.palette.secondary.main }} />
        );
      default:
        return <CircularProgress size={24} />;
    }
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
          padding: 2,
          backgroundColor: defaultTheme.palette.muted.dark,
          zIndex: 5,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 4,
            width: '100vw',
            height: '100vh',
          }}
        >
          <ExpandingCircleBackground
            color={defaultTheme.palette.background.default}
            duration={MIN_STARTUP_TIME_S * 1.4}
            expansionScale={100}
            initialOpacity={1}
            animateOpacity={1}
            initialAtXPercent={0}
            initialAtYPercent={0}
            animateAtXPercent={isMobile ? 50 : 0}
            animateAtYPercent={isMobile ? 0 : 50}
          />
          <StaticCircleBackground
            color={defaultTheme.palette.muted.dark}
            sizePercent={isMobile ? 60 : 50}
            atXPercent={isMobile ? 50 : 100}
            atYPercent={isMobile ? 100 : 50}
            opacity={1}
          />
        </Box>
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'center',
            alignItems: 'center',
            width: isMobile ? '100%' : 2 / 3,
            height: '100%',
            zIndex: 5,
            pb: isMobile ? 10 : 0, // to keep the icon away from the table
          }}
        >
          <Box sx={{ fontSize: isMobile ? '4rem' : '10vh' }}>
            <Title theme={defaultTheme} />
          </Box>
          <Box
            sx={{
              width: (size * 2) / 3,
              height: (size * 2) / 3,
              display: 'flex',
              zIndex: 5,
            }}
          >
            <LogoSvgComponent />
          </Box>
        </Box>

        <TableContainer
          // component={Paper}
          sx={{
            borderRadius: 5,
            display: 'flex',
            width: isMobile ? '100%' : '33.33%',
            maxHeight: isMobile ? '50%' : undefined,

            padding: isMobile ? 1 : 2,
            zIndex: 5,
            border: `2px solid ${defaultTheme.palette.muted.light}`,
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Load Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from(loadingMap.keys()).map((key) => {
                const comp = loadingMap.get(key);
                return (
                  <TableRow key={key}>
                    <TableCell>{key}</TableCell>
                    <TableCell align="center">
                      <span>
                        {comp ? (
                          getStatusIcon(comp.status)
                        ) : (
                          <CircularProgress size={24} />
                        )}
                      </span>
                    </TableCell>
                    <TableCell align="center">
                      {comp && comp.time > 0 ? comp.time + ' ms' : '---'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </ThemeProvider>
  );
};
