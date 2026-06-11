import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
} from "@mui/material";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { latex } from "codemirror-lang-latex";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import { BlockMath } from "react-katex";

export interface LatexDialogProps {
  open: boolean;
  onClose: (latex: string) => void;
  onCancel?: (latex: string) => void;
  latexCode?: string;
}
export const LatexDialog: React.FC<LatexDialogProps> = ({
  open,
  onClose,
  onCancel,
  latexCode,
}) => {
  const [value, setValue] = useState(latexCode || "");
  const [latexType, setLatexType] = useState<"inline" | "block">("inline");
  const onCloseWrap = (result: string) => {
    onClose(result);
    setValue("");
  };

  // on re-opens, we need to insert LatexCode (passed as prop) into the editor
  useEffect(() => {
    setValue(latexCode ?? "");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onCancel?.(value);
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
            <BlockMath math={value} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <IconButton title="ok" onClick={() => onCloseWrap(value)}>
          <DoneIcon />
        </IconButton>
        <IconButton title="cancel" onClick={() => onCancel?.(value)}>
          <CloseIcon />
        </IconButton>
      </DialogActions>
    </Dialog>
  );
};
