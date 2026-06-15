import {
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { latex } from "codemirror-lang-latex";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import katex from "katex";

export interface LatexDialogProps {
  // compressed is assumed, when latex start with \displaystyle
  open: boolean;
  onClose: (
    latex: string,
    latexType: "inline" | "block",
    compressed: boolean,
  ) => void;
  setOpen?: (open: boolean) => void;
  onCancel?: (
    latex: string,
    latexType: "inline" | "block",
    compressed: boolean,
  ) => void;
  latexCode?: string;
  initialLatexType?: "inline" | "block";
}

export const LatexDialog: React.FC<LatexDialogProps> = ({
  open,
  onClose,
  onCancel,
  latexCode,
  initialLatexType,
  setOpen,
}) => {
  const [value, setValue] = useState(latexCode || "");
  const [latexType, setLatexType] = useState<"inline" | "block">(
    initialLatexType || "inline",
  );

  // compressed latex means its good for one line
  const [compressed, setCompressed] = useState(false);
  const onCloseWrap = (result: string) => {
    // readd the removed displaystyle, which was converted into the compressed state
    if (!compressed) {
      result = `\\displaystyle ${result}`;
    }

    onClose(result, latexType, compressed);
    setOpen?.(false);
    setValue("");
  };

  // on re-opens, we need to insert LatexCode (passed as prop) into the editor
  useEffect(() => {
    if (latexCode?.startsWith("\\displaystyle")) {
      // this means, integrals, fractions, sums etc. are written big, not one line
      setCompressed(false);
      // replace the first displaystyle with an empty string
      setValue(latexCode.replace(/\\displaystyle\s*/, ""));
    } else {
      setValue(latexCode || "");
      setCompressed(true);
    }
    setLatexType(initialLatexType || "inline");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onCancel?.(value, latexType, compressed);
          setOpen?.(false);
          return;
        }
        onCloseWrap("");
      }}
      fullWidth
      maxWidth="sm"
      sx={{
        minWidth: "400px",
        "& .MuiDialog-paper": {
          minHeight: {
            xs: "80%", // Full height on small screens
            sm: "30%", // Minimum height on larger screens
            md: "20%",
          },
        },
      }}
    >
      <DialogTitle>Enter LaTeX</DialogTitle>
      <DialogContent sx={{ alignItems: "center" }}>
        <Stack direction={"column"}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignContent: "center",

              alignItems: "center",

              height: "50%",
              width: "100%",
            }}
          >
            <CodeMirror
              style={{ flex: 1 }}
              value={value}
              onChange={(newValue, _) => setValue(newValue)}
              extensions={[latex()]}
              theme={"dark"}
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              height: "50%",
              width: "100%",
            }}
          >
            {compressed ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(value, {
                    throwOnError: false,
                    displayMode: !compressed,
                  }),
                }}
              />
            ) : (
              <div
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(value, {
                    throwOnError: false,
                    displayMode: !compressed,
                  }),
                }}
              />
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <ToggleButtonGroup
          value={latexType}
          onChange={(_, newType) => setLatexType(newType)}
          exclusive
          size="small"
        >
          <Tooltip title="Math is within a textline">
            <ToggleButton value="inline">Inline</ToggleButton>
          </Tooltip>
          <Tooltip title="Math has it's own line">
            <ToggleButton value="block">Block</ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={compressed ? "compressed" : "notCompressed"}
          onChange={(_, newValue) => setCompressed(newValue === "compressed")}
          exclusive
          size="small"
        >
          <Tooltip
            title={
              <>
                smaller symbols:{" "}
                <span
                  dangerouslySetInnerHTML={{
                    __html: katex.renderToString("\\int_a^b f(x) dx", {
                      throwOnError: false,
                      displayMode: false,
                    }),
                  }}
                />
              </>
            }
          >
            <ToggleButton value="compressed">small Notation</ToggleButton>
          </Tooltip>
          <Tooltip
            title={
              <>
                bigger symbols:{" "}
                <span
                  dangerouslySetInnerHTML={{
                    __html: katex.renderToString(
                      "\\displaystyle \\int_a^b f(x) dx",
                      {
                        throwOnError: false,
                        displayMode: false,
                      },
                    ),
                  }}
                />
              </>
            }
          >
            <ToggleButton value="notCompressed">big Notation</ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>

        <Box>
          <IconButton title="ok" onClick={() => onCloseWrap(value)}>
            <DoneIcon />
          </IconButton>
          <IconButton
            title="cancel"
            onClick={() => {
              onCancel?.(value, latexType, compressed);
              setOpen?.(false);
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
