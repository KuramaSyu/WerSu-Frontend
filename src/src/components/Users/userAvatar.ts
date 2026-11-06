import type { SearchUserReply } from "../../api/models/userManagement";
import { DiscordLinkedAccountImpl } from "../../utils/DiscordLinkedAccount";

const DEFAULT_AVATAR_BASE = "https://cdn.discordapp.com/embed/avatars";

/**
 * Best-effort avatar URL for a user returned by the read-only user routes.
 *
 * The REST reply exposes the legacy `avatar` field (usually a Discord hash)
 * plus `discord_id`; linked-profile pictures are passed through as absolute
 * URLs. Anything unrecognisable falls back to Discord's default avatar so the
 * UI always has a stable image to render.
 */
export function userAvatarSrc(
  user: Pick<SearchUserReply, "id" | "avatar" | "discord_id"> | undefined,
): string {
  const raw = user?.avatar?.trim() ?? "";
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const discordId = user?.discord_id?.trim() ?? "";
  const numericDiscordId = /^\d+$/.test(discordId) ? discordId : "";

  if (numericDiscordId) {
    // Reuse the existing Discord account helper for both custom hashes
    // and the deterministic default avatar.
    return new DiscordLinkedAccountImpl(numericDiscordId).getAvatarUrl(raw);
  }

  return `${DEFAULT_AVATAR_BASE}/0.png`;
}

/** First visible character of a display name, for Avatar fallbacks. */
export function userInitial(
  user: Pick<SearchUserReply, "username" | "id"> | undefined,
): string {
  const name = user?.username?.trim() || user?.id?.trim() || "?";
  return name.slice(0, 1).toUpperCase();
}
