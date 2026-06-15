import React, { useMemo, useEffect, useState } from "react";
import { Box, Typography, alpha } from "@mui/material";
import { RestNotesSearchType, type MinimalNote } from "../../api/models/search";
import { useThemeStore } from "../../zustand/useThemeStore";
import type { CustomTheme } from "../../theme/customTheme";
import { shortenText } from "../../utils/shorten";

interface SearchResultHighlightProps {
  content: string;
  query: string;
  searchType: RestNotesSearchType;
  contextChars?: number;
  theme: CustomTheme;
  minimumLengthForHighlight?: number; // Minimum length of query to trigger highlighting
}

/**
 * Extracts context around matches in content and highlights them.
 * For exact/typo-tolerant search, shows 100 chars before and after.
 */
export const highlightSearchMatch = ({
  content,
  query,
  searchType,
  contextChars = 100,
  theme,
  minimumLengthForHighlight,
}: SearchResultHighlightProps): React.ReactNode[] => {
  const minLength = minimumLengthForHighlight ?? 3; // Default to 3 if not provided
  if (
    searchType === RestNotesSearchType.KEYWORD ||
    searchType === RestNotesSearchType.TYPO_TOLERANT ||
    searchType === RestNotesSearchType.LATEST ||
    searchType === RestNotesSearchType.CONTEXT
  ) {
    // For keyword and typo-tolerant: find matches and show context
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const matches: { start: number; end: number }[] = [];
    let startIndex = 0; // Start searching from the beginning if query is long enough

    // Find first 3 matches
    for (var i = 0; i < (query.length >= minLength ? 3 : 0); i++) {
      const index = lowerContent.indexOf(lowerQuery, startIndex);
      if (index === -1) break;
      matches.push({ start: index, end: index + query.length });
      startIndex = index + 1;
    }

    if (matches.length === 0)
      return [
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary }}
        >
          {shortenText(content, 200)}
        </Typography>,
      ];

    const fragments: React.ReactNode[] = [];

    matches.forEach((match, idx) => {
      var contextStart = Math.max(0, match.start - contextChars);
      var contextEnd = Math.min(content.length, match.end + contextChars);

      // Add ellipsis if context is truncated at start
      let contextText = content.substring(contextStart, contextEnd);
      if (contextStart > 0) {
        contextText = "..." + contextText;
        contextStart -= 3; // Adjust match positions for added ellipsis
        contextEnd -= 3;
      }
      if (contextEnd < content.length) {
        contextText = contextText + "...";
      }

      // Find where the match is in the context string
      const matchOffsetInContext = match.start - contextStart;
      const before = contextText.substring(
        0,
        Math.max(0, matchOffsetInContext),
      );
      const matchText = contextText.substring(
        Math.max(0, matchOffsetInContext),
        matchOffsetInContext + query.length,
      );
      const after = contextText.substring(matchOffsetInContext + query.length);

      fragments.push(
        <Box key={`context-${idx}`} sx={{ mb: 1, fontFamily: "monospace" }}>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            {before}
            <Box
              component="span"
              sx={{
                // backgroundColor: alpha(theme.palette.secondary.dark, 0.66),
                fontWeight: "bold",
                color: theme.palette.text.primary,
                borderRadius: 1,
                px: "2px",
              }}
            >
              {matchText}
            </Box>
            {after}
          </Typography>
        </Box>,
      );
    });

    return fragments;
  }

  return [content];
};
