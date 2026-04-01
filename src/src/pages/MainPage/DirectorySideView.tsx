import { Card, Stack } from "@mui/material";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";

export const DirectorySideView = () => {
  const { directoriesById } = useDirectoryStore();
  return (
    <Stack direction={"column"}>
      {Object.values(directoriesById).map((directory) => (
        <Card key={directory.id} variant="outlined" sx={{ mb: 1, p: 1 }}>
          {directory.display_name || directory.name}
        </Card>
      ))}
    </Stack>
  );
};
