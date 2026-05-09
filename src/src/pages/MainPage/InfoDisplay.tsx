import React, { useEffect, useRef, useState } from "react";
import {
  Snackbar,
  Alert,
  Typography,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  AccordionActions,
  Box,
} from "@mui/material";
import useInfoStore from "../../zustand/InfoStore";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useThemeStore } from "../../zustand/useThemeStore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { SimpleTimeBasedProgressBar } from "../../components/SimpleTimebasedProgressBar";

const InfoDisplay: React.FC = () => {
  const { Message } = useInfoStore();
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const { isMobile } = useBreakpoint();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (Message && Message.message !== "") {
      setOpen(true);
    }
    setShowDetails(false);
  }, [Message]);

  // closes the snackbar after the duration of the message,
  // unless the user has expanded it to show details
  useEffect(() => {
    if (!open || showDetails) {
      return;
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, Message.getDurationMs());

    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [Message, open, showDetails]);

  const handleClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      key={Message.message}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateRows: "auto auto",
          width: isMobile ? "90vw" : 420,
          maxWidth: "90vw",
        }}
      >
        <Accordion
          expanded={showDetails}
          onChange={(_event, expanded) => setShowDetails(expanded)}
          sx={{ width: "100%" }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`${Message.message}-panel2-content`}
            id={`${Message.message}-panel2-header`}
          >
            <Alert
              severity={Message.severity}
              sx={{
                "& .MuiAlert-icon": {
                  alignItems: "center",
                },
                backgroundColor: theme.palette.muted.main,
                width: "100%",
              }}
            >
              <Typography component="span">{Message.message}</Typography>
            </Alert>
          </AccordionSummary>
          <AccordionDetails>{Message.description}</AccordionDetails>
          <AccordionActions>
            <Button onClick={() => setOpen(false)}>ok</Button>
          </AccordionActions>
        </Accordion>
        {!showDetails && (
          <SimpleTimeBasedProgressBar durationMs={Message.getDurationMs()} />
        )}
      </Box>
    </Snackbar>
  );
};

export default InfoDisplay;
