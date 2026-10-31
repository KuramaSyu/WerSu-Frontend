import React from "react";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { Box, Chip, Tooltip, Typography } from "@mui/material";
import type { DirectoryReply } from "../../../api/models/directory";
import { colorFromString } from "../../../utils/blendWithContrast";
import { fuzzyMatch } from "../../../utils/fuzzySearch";
import { directoryLabel, directoryPathString } from "./directoryPath";
import type {
  SearchResult,
  SearchResultContent,
  SearchResultContext,
} from "./SearchResult";

/** Label candidates a directory can be fuzzy-matched against. */
const matchCandidates = (directory: DirectoryReply): string[] =>
  [
    directory.display_name || directory.name || directory.id,
    directory.name,
    directory.slug,
    directory.id,
  ].filter((c): c is string => !!c);

export interface DirectoryMatch {
  directory: DirectoryReply;
  score: number;
  /** True when the query is literally contained in one of the labels. */
  exact: boolean;
}

/**
 * Fuzzy-search every known directory. Non-note results always use fuzzy
 * matching regardless of the note search strategy / filter mode.
 */
export function searchDirectories(
  query: string,
  directoriesById: Record<string, DirectoryReply>,
  limit = 50,
): DirectoryMatch[] {
  const q = query.trim();
  if (!q) return [];
  const lowerQuery = q.toLowerCase();

  const matches: DirectoryMatch[] = [];
  for (const directory of Object.values(directoriesById)) {
    if (!directory) continue;
    let best: number | null = null;
    let exact = false;
    for (const candidate of matchCandidates(directory)) {
      if (candidate.toLowerCase().includes(lowerQuery)) {
        exact = true;
      }
      const match = fuzzyMatch(q, candidate);
      if (match && (best === null || match.score > best)) {
        best = match.score;
      }
    }
    if (best !== null) {
      matches.push({ directory, score: best, exact });
    }
  }

  // Literal / partial-exact hits outrank purely fuzzy ones, then by score.
  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return directoryLabel(a.directory.id, directoriesById).localeCompare(
      directoryLabel(b.directory.id, directoriesById),
    );
  });

  return matches.slice(0, limit);
}

/** Render `text` with the fuzzy-matched characters emphasised. */
const highlightFuzzy = (
  text: string,
  query: string,
  ctx: SearchResultContext,
): React.ReactNode => {
  const match = fuzzyMatch(query, text);
  if (!match || match.indices.length === 0) return text;

  const indices = new Set(match.indices);
  const nodes: React.ReactNode[] = [];
  let buffer = "";
  let bufferMatched = false;

  const flush = () => {
    if (buffer.length === 0) return;
    nodes.push(
      bufferMatched ? (
        <Box
          key={nodes.length}
          component="span"
          sx={{
            fontWeight: "bold",
            color: ctx.theme.palette.text.primary,
          }}
        >
          {buffer}
        </Box>
      ) : (
        buffer
      ),
    );
    buffer = "";
  };

  for (let i = 0; i < text.length; i++) {
    const isMatch = indices.has(i);
    if (isMatch !== bufferMatched) {
      flush();
      bufferMatched = isMatch;
    }
    buffer += text[i];
  }
  flush();

  return <>{nodes}</>;
};

/** Search result backed by a directory: click opens the directory view. */
export class DirectorySearchResult implements SearchResult {
  private readonly label: string;

  constructor(
    private readonly directory: DirectoryReply,
    private readonly ctx: SearchResultContext,
  ) {
    this.label = directoryLabel(directory.id, ctx.directoriesById);
  }

  get_id(): string {
    return this.directory.id;
  }

  get_title(): React.ReactNode {
    return highlightFuzzy(this.label, this.ctx.searchQuery, this.ctx);
  }

  get_content(): SearchResultContent {
    const description = this.directory.description?.trim();
    if (description) return description;
    return (
      <Typography variant="body2" color="text.secondary">
        Directory
      </Typography>
    );
  }

  get_type_icon(): React.ReactNode {
    return <FolderOutlinedIcon fontSize="small" />;
  }

  get_type_label(): string {
    return "Directory";
  }

  get_accent_color(): string {
    return colorFromString(this.directory.id, this.ctx.theme);
  }

  get_meta(): React.ReactNode {
    const path = directoryPathString(
      this.directory.id,
      this.ctx.directoriesById,
    );
    return (
      <Tooltip title={path} placement="top" arrow>
        <Chip label={path} variant="outlined" size="small" />
      </Tooltip>
    );
  }

  on_click(): void {
    this.ctx.navigate(`/d/${this.directory.id}`);
    this.ctx.closeOverlay();
  }
}
