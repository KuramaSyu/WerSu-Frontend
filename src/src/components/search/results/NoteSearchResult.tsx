import React from "react";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { Chip, Tooltip } from "@mui/material";
import { formatDistanceToNowStrict } from "date-fns";
import type { Note } from "../../../api/models/search";
import { colorFromString } from "../../../utils/blendWithContrast";
import { highlightSearchMatch } from "../SearchResultHighlights";
import { directoryLabel, directoryPathString } from "./directoryPath";
import type {
  SearchResult,
  SearchResultContent,
  SearchResultContext,
} from "./SearchResult";

/** Search result backed by a note: click opens the note view. */
export class NoteSearchResult implements SearchResult {
  constructor(
    private readonly note: Note,
    private readonly ctx: SearchResultContext,
  ) {}

  get_id(): string {
    return this.note.id;
  }

  get_title(): React.ReactNode {
    return this.note.title;
  }

  get_content(): SearchResultContent {
    return highlightSearchMatch({
      content: this.note.stripped_content,
      query: this.ctx.searchQuery,
      searchType: this.ctx.searchType,
      contextChars: 100,
      theme: this.ctx.theme,
    });
  }

  get_type_icon(): React.ReactNode {
    return <ArticleOutlinedIcon fontSize="small" />;
  }

  get_type_label(): string {
    return "Note";
  }

  get_accent_color(): string {
    return colorFromString(this.note.get_dir() || "root", this.ctx.theme);
  }

  get_meta(): React.ReactNode {
    const { directoriesById } = this.ctx;
    const dirId = this.note.get_dir() ?? "root";
    const chipLabel =
      dirId === "root" || !directoriesById[dirId]
        ? "root"
        : directoryLabel(dirId, directoriesById);
    const pathTip = directoryPathString(dirId, directoriesById);
    const timestamp = formatDistanceToNowStrict(new Date(this.note.updated_at), {
      addSuffix: true,
    });

    return (
      <>
        <Tooltip title={pathTip} placement="top" arrow>
          <Chip label={chipLabel} variant="outlined" size="small" />
        </Tooltip>
        <Chip label={timestamp} variant="outlined" size="small" />
      </>
    );
  }

  on_click(): void {
    this.ctx.navigate(`/n/${this.note.id}`);
    this.ctx.closeOverlay();
  }
}
