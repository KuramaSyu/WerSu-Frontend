import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  Stack,
  Paper,
  CircularProgress,
  Chip,
  alpha,
  Portal,
  IconButton,
  Divider,
  Fade,
  Grow,
  Collapse,
  Input,
  TextField,
  InputAdornment,
  Button,
  ToggleButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import {
  RestNotesSearchType,
  type MinimalNote,
  Note,
} from "../../api/models/search";
import { M1, M2, M3, M4, M5, M6 } from "../../statics";
import { useInfiniteNoteSearch } from "../../api/queries/useNoteQueries";
import { SearchNotesApi } from "../../api/SearchNotesApi";
import SearchStrategySelect from "../SearchStrategySelect";
import SearchIcon from "@mui/icons-material/Search";
import { highlightSearchMatch } from "./SearchResultHighlights";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import { useUsersStore } from "../../zustand/userStore";
import { formatDistanceToNowStrict } from "date-fns";
import { getDirectoryPath } from "../../utils/getDirectoryPath";
import { colorFromString } from "../../utils/blendWithContrast";
import { color } from "framer-motion";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import {
  ColoredToggleButton,
  OutlinedToggleButton,
} from "../ColoredToggleButton";
import { LogoSvgComponent } from "../../pages/LoadingPage/Main";
import { animated, useTrail } from "@react-spring/web";
import { useNavigate, useSearchParams } from "react-router-dom";
import { set } from "zod";

const INITIAL_DEBOUCE_DELAY = 500; // to prevent lag in mode selection
const DEBOUNCE_DELAY = 125;

export interface SearchResultsOverlayProps {
  open: boolean;
  onClose: () => void;
  isLoading?: boolean;
  searchQuery: string;
  searchType: RestNotesSearchType;
}

/**
 * SearchResultsOverlay displays search results in a modal-like overlay with a backdrop.
 *
 * It supports keyboard dismissal (Escape), click-to-close backdrop behavior,
 * and renders loading, empty, or populated states based on `isLoading` and the
 * current `notes` collection. The overlay also shows metadata such as search
 * type and query, and highlights matches when appropriate.
 *
 * @param open - Whether the overlay is visible.
 * @param onClose - Callback invoked to close the overlay.
 * @param isLoading - Indicates if search results are currently loading.
 * @param searchQuery - The query string used for searching, shown in the header.
 * @param searchType - The search mode used to label results and control highlighting.
 *
 * @returns The overlay UI when open, otherwise `null`.
 */
export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = ({
  open,
  onClose,
  isLoading = false,
}) => {
  const { theme } = useThemeStore();
  const { users } = useUsersStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchType, setSearchType] = useState<RestNotesSearchType>(
    RestNotesSearchType.CONTEXT,
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // to get directory names
  const { directoriesById } = useDirectoryStore();

  // get results
  const { data } = useInfiniteNoteSearch(searchType, debouncedSearchText, 200);

  // extracted notes, but only if data is not loading -> otherwise short flickering
  // when changed the search query with text, that nothing was found, since data is undefined for a short time
  const notes = useRef<Note[]>([]);
  if (data !== undefined) {
    notes.current =
      data?.pages.flat().map((note) => new Note({ content: "", ...note })) ??
      [];
  }

  // list of all dirs which appear in the current note results
  const uniqueDirs = useMemo(() => {
    const dirs = new Set<string>();
    for (const note of notes.current) {
      const dir = note.get_dir() || "root";
      dirs.add(dir);
    }
    return Array.from(dirs).sort();
  }, [notes.current]);

  const [excludeDirs, setExcludeDirs] = useState<Set<string>>(new Set());

  // keybinds of overlay itself: ESC = close & clear search, Enter = clear search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        setSelectedIndex(0);
        setSearchQuery("");
      } else if (e.key === "Enter") {
        setSelectedIndex(0);
        // close is done in element itself, where also the note gets opened
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, searchQuery]);
  // debouce search input to prevent lags while typings
  useEffect(() => {
    if (!searchActive || searchQuery === "") {
      setDebouncedSearchText(searchQuery);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchQuery);
    }, DEBOUNCE_DELAY);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, searchActive]);

  return (
    <>
      {/* Backdrop - click to close */}
      <Fade
        in={open}
        timeout={theme.transitions.duration.complex}
        mountOnEnter
        unmountOnExit
      >
        <Box
          onClick={onClose}
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(
              theme.blendAgainstContrast(
                theme.palette.background.default,
                0.5,
                undefined,
              ),
              0.8,
            ),
            zIndex: 900,
          }}
        />
      </Fade>

      {/* Overlay panel */}
      <Portal>
        <Grow
          in={open}
          timeout={theme.transitions.duration.short}
          mountOnEnter
          unmountOnExit
        >
          <Box
            sx={{
              position: "fixed",
              top: "100px", // Below the search bar
              left: "15%",
              right: "15%",
              maxHeight: "85%",
              backgroundColor: theme.palette.background.default,
              borderRadius: M3,
              boxShadow: theme.shadows[8],
              zIndex: 1300,
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              display: "flex",
              flexDirection: "column",
              gap: M3,
              p: M3,
            }}
          >
            {/* Header with close button */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              position={"sticky"}
            >
              {/* search strategy */}
              <Box width={"20%"}>
                <SearchStrategySelect
                  searchType={searchType}
                  setSearchType={setSearchType}
                  color="primary"
                />
              </Box>

              {/* search field */}
              <Box
                width={"60%"}
                sx={{
                  justifyContent: "center",
                  display: "flex",
                }}
              >
                <TextField
                  autoFocus
                  placeholder="Search"
                  variant="outlined"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  onBlur={() => setSearchActive(false)}
                  color="primary"
                  sx={{
                    width: "fit-content",
                    minWidth: "50%",
                    maxWidth: "100%",
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: "1rem" }} />
                        </InputAdornment>
                      ),
                      sx: {
                        borderRadius: M4,
                        "& .MuiOutlinedInput-input": {
                          padding: "calc(1em / 1.6) 0.5rem",
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* result count and close button */}
              <Box
                sx={{
                  width: "20%",
                  justifyContent: "flex-end",
                  display: "flex",
                }}
              >
                <Button
                  size="large"
                  variant="outlined"
                  onClick={onClose}
                  color="primary"
                  sx={{
                    px: 6,
                    gap: 1,
                    width: "20%",
                    borderRadius: theme.shape.borderRadius,
                  }}
                >
                  <CloseIcon fontSize="medium" />
                  <KeyboardShortcut shortcut="esc" onlyText={true} />
                </Button>
              </Box>
            </Stack>

            {/* selected and unselected directories */}
            <Stack direction={"row"}>
              {/* selected dirs */}
              <Stack
                direction="row"
                sx={{
                  display: "flex",
                  width: "50%",
                  justifyContent: "flex-start",
                }}
                spacing={2}
              >
                {uniqueDirs.map((dir) => {
                  const isSelected = !excludeDirs.has(dir);

                  return (
                    <Grow in={isSelected} unmountOnExit>
                      {
                        <OutlinedToggleButton
                          size={"small"}
                          value="check"
                          selected={isSelected}
                          onChange={() => {
                            setExcludeDirs((prev) => {
                              const newSet = new Set(prev);
                              if (prev.has(dir)) {
                                newSet.delete(dir);
                              } else {
                                newSet.add(dir);
                              }
                              return newSet;
                            });
                          }}
                          accentColor={colorFromString(dir, theme)}
                        >
                          {directoriesById[dir]?.display_name ||
                            directoriesById[dir]?.name ||
                            "root"}
                        </OutlinedToggleButton>
                      }
                    </Grow>
                  );
                })}
              </Stack>
              {/* unselected dirs */}
              <Stack
                direction="row"
                sx={{
                  display: "flex",
                  width: "50%",
                  justifyContent: "flex-end",
                }}
                spacing={2}
              >
                {uniqueDirs.map((dir) => {
                  const isSelected = !excludeDirs.has(dir);
                  return (
                    <Grow in={!isSelected} unmountOnExit>
                      <OutlinedToggleButton
                        size={"small"}
                        value="check"
                        selected={isSelected}
                        onChange={() => {
                          setExcludeDirs((prev) => {
                            const newSet = new Set(prev);
                            if (prev.has(dir)) {
                              newSet.delete(dir);
                            } else {
                              newSet.add(dir);
                            }
                            return newSet;
                          });
                        }}
                        accentColor={colorFromString(dir, theme)}
                      >
                        {directoriesById[dir]?.display_name ||
                          directoriesById[dir]?.name ||
                          "root"}
                      </OutlinedToggleButton>
                    </Grow>
                  );
                })}
              </Stack>
            </Stack>
            <Box
              sx={{
                zIndex: 1301,
                flex: 1,
                overflowY: "auto",
                scrollbarGutter: "stable",
                position: "relative",
              }}
            >
              {/* scrollbar padding */}
              <Box sx={{ width: "98%" }}>
                {/* Results or Loading */}
                <ResultContent
                  searchQuery={debouncedSearchText}
                  searchType={searchType}
                  theme={theme}
                  users={users}
                  filteredNotes={notes.current.filter((note) => {
                    const dir = note.get_dir() || "root";
                    return !excludeDirs.has(dir);
                  })}
                  setSeacrhQuery={setSearchQuery}
                />
              </Box>
            </Box>
          </Box>
        </Grow>
      </Portal>
    </>
  );
};

export default SearchResultsOverlay;

export const TextTrail = ({ children }: { children: React.ReactNode }) => {
  const items = React.Children.toArray(children);
  const trail = useTrail(items.length, {
    from: {
      opacity: 0,
      transform: "translate3d(0,16px,0)",
    },
    to: {
      opacity: 1,
      transform: "translate3d(0,0px,0)",
    },
  });

  return (
    <>
      {trail.map((style, index) => (
        <animated.div key={index} style={style}>
          {items[index]}
        </animated.div>
      ))}
    </>
  );
};

interface ResultContentProps {
  searchQuery: string;
  searchType: RestNotesSearchType;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
  users: ReturnType<typeof useUsersStore.getState>["users"];
  filteredNotes: Note[];
  setSeacrhQuery: (query: string) => void;
}

const ResultContent = ({
  searchQuery,
  searchType,
  theme,
  users,
  filteredNotes,
  setSeacrhQuery,
}: ResultContentProps) => {
  const navigate = useNavigate();
  const { setIsDialogOpen } = useSearchNotesStore();
  // to scroll when navigating with keyboard
  const selectedRef = useRef<HTMLDivElement>(null);

  // index for current selected note
  const [selectedIndex, setSelectedIndex] = useState(0);

  // to disable navigation when mouse is used
  const [selectedWith, setSelectedWith] = useState<"mouse" | "keyboard">(
    "mouse",
  );

  const [hoverEnabled, setHoverEnabled] = useState(true);

  // UX: when navigating out of dialog with keyboard, scroll to selected note
  useEffect(() => {
    if (selectedWith !== "keyboard") return;
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedIndex, selectedWith]);

  // UX: keybindings for navigating results
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setSelectedWith("keyboard");
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredNotes.length - 1),
        );
        setHoverEnabled(false);
      } else if (e.key === "ArrowUp") {
        setSelectedWith("keyboard");
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        setHoverEnabled(false);
      } else if (e.key === "Enter") {
        selectedRef.current?.click();
        setSeacrhQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredNotes, setSelectedIndex, setSelectedWith]);

  // UX: disable mouse when user types, to prevent accidental mouse hovers
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      // vector distance -> ||mouse movement|| > 20 => re-enable hover
      const distance = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (distance > 20) {
        setHoverEnabled(true);
      }

      lastX = e.clientX;
      lastY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [setHoverEnabled]);

  return (
    <>
      <Stack spacing={M3}>
        {filteredNotes.map((note: Note, index: number) => {
          const isSelected = index === selectedIndex;
          return (
            <Paper
              ref={isSelected ? selectedRef : null}
              elevation={isSelected ? 5 : 1}
              onMouseEnter={() => {
                if (hoverEnabled) {
                  setSelectedWith("mouse");
                  setSelectedIndex(index);
                }
              }}
              onClick={() => {
                navigate(`/n/${note.id}`);
                setIsDialogOpen(false);
              }}
              key={`${note.id}-${index}`}
              sx={{
                p: M2,
                pl: M3,
                //   backgroundColor: theme.palette.background.paper,
                borderLeft: `5px solid ${colorFromString(note.get_dir() || "root", theme)}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
                transform: isSelected ? "translateX(6px)" : "none",

                display: "flex",
                flexDirection: "row",
                gap: M2,
              }}
            >
              <Box className="note header" minWidth={3 / 8}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: "bold",
                    mb: M2,
                    color: theme.palette.text.primary,
                  }}
                >
                  {note.title}
                </Typography>

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mb: M2 }}
                  minWidth={5 / 8}
                >
                  <Chip
                    label={users[note.author_id]?.username || "unknown"}
                    variant="outlined"
                    size="small"
                  ></Chip>

                  <Chip
                    label={formatDistanceToNowStrict(
                      new Date(note.updated_at),
                      {
                        addSuffix: true,
                      },
                    )}
                    variant="outlined"
                    size="small"
                  />
                </Stack>
              </Box>

              <Divider orientation="vertical" flexItem />
              {/* Highlight Box */}

              {highlightSearchMatch({
                content: note.stripped_content,
                query: searchQuery,
                searchType,
                contextChars: 100,
                theme,
              })}
            </Paper>
          );
        })}
      </Stack>
      <Fade
        in={filteredNotes.length === 0}
        timeout={{ enter: theme.transitions.duration.short, exit: 0 }}
        unmountOnExit
      >
        <Stack direction={"row"} alignItems={"center"}>
          <Stack
            direction={"column"}
            sx={{
              width: 3 / 8,
              px: M4,
              gap: M3,
              justifyItems: "center",
              alignItems: "center",
            }}
          >
            <TextTrail key={searchQuery ? "search" : "no-search"}>
              <Typography variant="h4" color="text.primary">
                I took a deep dive,
              </Typography>
              <Typography variant="h5" color="text.secondary">
                but hell, there is no
              </Typography>
              <Typography
                key={searchQuery || "empty"}
                color="primary"
                variant={searchQuery ? "h3" : "h6"}
                py={M3}
              >
                {searchQuery || "Oh, you haven't even searched yet - nvm"}
              </Typography>
              {searchQuery && (
                <Typography variant="h5" color="text.secondary">
                  in the abyss of your notes.
                </Typography>
              )}
            </TextTrail>
          </Stack>
          <Box width={5 / 8} justifyContent={"center"} sx={{ display: "flex" }}>
            <Box
              width={5 / 8}
              justifyContent={"center"}
              sx={{ display: "flex" }}
            >
              <LogoSvgComponent />
            </Box>
          </Box>
        </Stack>
      </Fade>
    </>
  );
};
