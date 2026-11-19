import React from "react";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import NotesIcon from "@mui/icons-material/Notes";
import { Stack, Typography } from "@mui/material";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { RailSection } from "../../components/Panels/RailSection";
import type { TagReply } from "../../api/models/tag";
import { tagLabel } from "../../api/models/tag";

interface TagLeftPanelProps {
  tag?: TagReply;
  tagId: string;
  noteCount?: number;
  isLoading: boolean;
}

/** Left-rail metadata for the tag page. */
export const TagLeftPanel: React.FC<TagLeftPanelProps> = ({
  tag,
  tagId,
  noteCount,
  isLoading,
}) => {
  const label = tagLabel(tag, tagId);

  return (
    <UpperPanel spacing={2.5}>
      <RailSection
        title="Tag"
        description="Every note carrying this label."
        icon={<LocalOfferOutlinedIcon />}
      >
        {isLoading ? (
          <Typography variant="body2" color="textSecondary">
            Loading tag...
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Stack spacing={0.25}>
              <Typography variant="caption" color="textSecondary">
                Label
              </Typography>
              <Typography variant="body2">{label}</Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography variant="caption" color="textSecondary">
                Slug
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {tag?.slug ?? tagId}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <NotesIcon fontSize="small" color="disabled" />
              <Typography variant="body2" color="textSecondary">
                {noteCount === undefined
                  ? "Loading notes..."
                  : `${String(noteCount)} ${noteCount === 1 ? "note" : "notes"}`}
              </Typography>
            </Stack>
          </Stack>
        )}
      </RailSection>
    </UpperPanel>
  );
};
