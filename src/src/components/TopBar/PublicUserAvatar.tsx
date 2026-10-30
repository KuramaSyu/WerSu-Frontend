import React from "react";
import { Avatar } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { usePublicUserStore } from "../../zustand/usePublicUserStore";
import { colorFromString } from "../../utils/blendWithContrast";
import { displayInitials } from "../../utils/publicUserName";

export interface PublicUserAvatarProps {
  /** Rendered width / height in px. */
  size?: number;
  /** Initials font size in px. */
  fontSize?: number;
}

/**
 * Letter avatar for an anonymous public viewer: their generated /
 * edited handle rendered as initials over a theme-harmonised colour
 * derived from the name. Mirrors the public-user fallback that
 * `VersionInfo` already uses for live collaborators.
 */
export const PublicUserAvatar: React.FC<PublicUserAvatarProps> = ({
  size = 36,
  fontSize = 14,
}) => {
  const { theme } = useThemeStore();
  const name = usePublicUserStore((s) => s.name);

  return (
    <Avatar
      alt={name}
      sx={{
        width: size,
        height: size,
        fontSize,
        fontWeight: 600,
        bgcolor: colorFromString(name, theme),
        color: "#fff",
      }}
    >
      {displayInitials(name)}
    </Avatar>
  );
};

export default PublicUserAvatar;
