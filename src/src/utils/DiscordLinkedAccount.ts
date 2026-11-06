// Discord-side data attached to a WerSu account via the linked-credentials
// endpoint. Carries the raw snowflake; everything derived from it
// (default-avatar URL, account-creation date) lives behind methods so
// callers never reimplement the snowflake math.

/**
 * Discord stores user IDs as 64-bit snowflakes. The top 42 bits are
 * the millisecond timestamp the account was created at; the epoch
 * Discord uses is the first millisecond of 2015 (1420070400000).
 */
export const DISCORD_SNOWFLAKE_EPOCH_MS = 1420070400000;

export interface DiscordLinkedAccount {
  id: string;
  /** Default-avatar URL the SPA can render without a Discord API call. */
  getDefaultAvatarUrl(): string;
  /** Avatar URL for a Discord avatar hash, or the default when empty. */
  getAvatarUrl(avatarHash?: string): string;
  /** Account-creation date derived from the snowflake. */
  getCreatedAt(): Date;
}

export class DiscordLinkedAccountImpl implements DiscordLinkedAccount {
  constructor(public readonly id: string) {}

  getDefaultAvatarUrl(): string {
    try {
      const snowflake = BigInt(this.id);
      const index = Number((snowflake >> 22n) % 5n);
      return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    } catch {
      // Malformed snowflake -> fall back to Discord's index-0 default
      // so the row still renders.
      return `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
  }

  /**
   * Resolve a Discord avatar hash to its CDN URL.
   *
   * Discord hashes may already include an extension; bare hashes default
   * to png. An empty hash falls back to the deterministic default avatar.
   */
  getAvatarUrl(avatarHash?: string): string {
    const hash = avatarHash?.trim() ?? "";
    if (!hash) {
      return this.getDefaultAvatarUrl();
    }
    try {
      BigInt(this.id);
    } catch {
      return this.getDefaultAvatarUrl();
    }
    const ext = /\.[a-z0-9]+$/i.test(hash)
      ? ""
      : hash.endsWith("_a")
        ? ".gif"
        : ".png";
    return `https://cdn.discordapp.com/avatars/${this.id}/${hash}${ext}`;
  }

  getCreatedAt(): Date {
    try {
      const snowflake = BigInt(this.id);
      const ms = (snowflake >> 22n) + BigInt(DISCORD_SNOWFLAKE_EPOCH_MS);
      return new Date(Number(ms));
    } catch {
      return new Date(NaN);
    }
  }
}
