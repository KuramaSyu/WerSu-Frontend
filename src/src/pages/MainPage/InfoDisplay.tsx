import React, { useState, useEffect, use } from 'react';
import {
  Snackbar,
  Alert,
  Typography,
  Button,
  Box,
  LinearProgress,
} from '@mui/material';
import useInfoStore, { SnackbarUpdateImpl } from '../../zustand/InfoStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { set } from 'zod';
import { useThemeStore } from '../../zustand/useThemeStore';

const InfoDisplay: React.FC = () => {
  const { Message } = useInfoStore();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const INTERVAL = 100;
  const { isMobile } = useBreakpoint();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (Message && Message.message !== '') {
      setOpen(true);
    }

    const steps = Message.getDurationMs() / INTERVAL;
    const increment = 100 / steps;

    // timer which increases
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          window.setTimeout(() => {
            // this delay is used, that the loading bar
            // actually reaches the end due to animations
            setOpen(false);
            setProgress(0);
          }, INTERVAL * 3);
          return 100;
        }
        return next;
      });
    }, INTERVAL);
    // close when timer is done

    return () => clearInterval(timer);
  }, [Message]);

  const handleClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      key={Message.message}
    >
      <Alert
        severity={Message.severity}
        sx={{
          '& .MuiAlert-icon': {
            alignItems: 'center',
          },
          backgroundColor: theme.palette.muted.main,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            minWidth: '20vw',
            maxWidth: '50vw',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'space-between',
          }}
        >
          <Typography variant="body1">{Message.message}</Typography>
          <Button onClick={() => setOpen(false)}>ok</Button>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            bottom: 0,
            left: 0,
          }}
        >
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 4 }}
          />
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default InfoDisplay;
