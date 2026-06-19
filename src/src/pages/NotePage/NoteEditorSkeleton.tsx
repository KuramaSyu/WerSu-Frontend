import React from "react";
import { Box, Paper, Skeleton, Stack } from "@mui/material";

export interface NoteEditorSkeletonProps {
  showSourceEditor?: boolean;
}

export const NoteEditorSkeleton: React.FC<NoteEditorSkeletonProps> = ({
  showSourceEditor = false,
}) => {
  return (
    <Paper
      elevation={1}
      sx={{
        flex: 1,
        px: 3,
        py: 3,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minHeight: 500,
      }}
    >
      <Stack
        direction="row"
        spacing={3}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Skeleton variant="rounded" width="45%" height={56} />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
        </Stack>
      </Stack>

      {showSourceEditor ? (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Skeleton variant="rounded" height={48} width="35%" />
          <Skeleton variant="rounded" height={18} width="92%" />
          <Skeleton variant="rounded" height={18} width="88%" />
          <Skeleton variant="rounded" height={18} width="95%" />
          <Skeleton variant="rounded" height={18} width="80%" />
          <Skeleton variant="rounded" height={220} />
        </Box>
      )}

      <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton variant="circular" width={48} height={48} />
      </Stack>
    </Paper>
  );
};
