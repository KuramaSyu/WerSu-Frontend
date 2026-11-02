import {
  Autocomplete,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import FolderIcon from "@mui/icons-material/Folder";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TuneIcon from "@mui/icons-material/Tune";
import ShareIcon from "@mui/icons-material/Share";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { useShelves } from "../../api/queries/shelfQueries";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { disambiguateLabels } from "../../utils/disambiguateLabels";
import type { ShelfReply } from "../../api/models/shelf";
import type { DirectoryReply } from "../../api/models/directory";

const shelfLabel = (shelf: ShelfReply): string =>
  shelf.display_name ?? shelf.slug ?? shelf.id;

const directoryLabel = (directory: DirectoryReply): string =>
  directory.display_name ?? directory.name ?? directory.slug ?? directory.id;

export interface SharesLeftPanelProps {
  /** Active shelf scope from the URL, if any. */
  shelfId?: string;
  /** Active directory scope from the URL, if any. */
  directoryId?: string;
  /** Called with the next shelf id, or undefined to clear the shelf scope. */
  onSelectShelf: (shelfId?: string) => void;
  /** Called with the next directory id, or undefined to clear it. */
  onSelectDirectory: (directoryId?: string) => void;
}

/**
 * Left-rail content for the shares page: shows the currently selected
 * scope element and lets the user swap it via a shelf / directory picker.
 */
export const SharesLeftPanel: React.FC<SharesLeftPanelProps> = ({
  shelfId,
  directoryId,
  onSelectShelf,
  onSelectDirectory,
}) => {
  const { data: shelves = [] } = useShelves({ include_books: true });
  const { list: directories = [] } = useAllDirectoriesQuery();

  const shelfLabels = disambiguateLabels(
    shelves,
    shelfLabel,
    (shelf) => shelf.id,
  );
  const directoryLabels = disambiguateLabels(
    directories,
    directoryLabel,
    (directory) => directory.shelf_ids?.[0] ?? directory.id,
    (directory) => directory.id,
  );

  const selectedShelf =
    shelves.find((shelf) => shelf.id === shelfId) ?? null;
  const selectedDirectory =
    directories.find((directory) => directory.id === directoryId) ?? null;

  const clearScope = () => {
    onSelectShelf(undefined);
    onSelectDirectory(undefined);
  };

  return (
    <UpperPanel spacing={2}>
      <PanelSection
        title="Selected"
        titleIcon={<ShareIcon fontSize="small" />}
      >
        {!selectedShelf && !selectedDirectory ? (
          <Typography variant="body2" color="text.secondary">
            All shares
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
            {selectedDirectory && (
              <Chip
                size="small"
                icon={<FolderIcon fontSize="small" />}
                label={
                  directoryLabels.get(selectedDirectory) ??
                  directoryLabel(selectedDirectory)
                }
              />
            )}
            {selectedShelf && (
              <Chip
                size="small"
                icon={<MenuBookIcon fontSize="small" />}
                label={
                  shelfLabels.get(selectedShelf) ?? shelfLabel(selectedShelf)
                }
              />
            )}
            <Button
              size="small"
              variant="text"
              startIcon={<ClearAllIcon fontSize="small" />}
              onClick={clearScope}
            >
              Show all shares
            </Button>
          </Stack>
        )}
      </PanelSection>

      <PanelSection title="Change scope" titleIcon={<TuneIcon fontSize="small" />}>
        <Stack spacing={2}>
          <Autocomplete<ShelfReply, false, false, false>
            size="small"
            options={shelves}
            value={selectedShelf}
            onChange={(_event, next) => onSelectShelf(next?.id)}
            getOptionLabel={(shelf) =>
              shelfLabels.get(shelf) ?? shelfLabel(shelf)
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Shelf"
                placeholder="All shelves"
              />
            )}
          />

          <Autocomplete<DirectoryReply, false, false, false>
            size="small"
            options={directories}
            value={selectedDirectory}
            onChange={(_event, next) => onSelectDirectory(next?.id)}
            getOptionLabel={(directory) =>
              directoryLabels.get(directory) ?? directoryLabel(directory)
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Directory"
                placeholder="All directories"
              />
            )}
          />
        </Stack>
      </PanelSection>
    </UpperPanel>
  );
};

export default SharesLeftPanel;
