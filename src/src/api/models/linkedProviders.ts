// Wire shapes and selectors for the linked-providers surface.
//
// Two endpoints the SPA consumes:
//   - GET  /api/auth/me/credentials         -> LinkedCredentialsReply
//   - GET  /api/auth/link/{p}/complete      -> HTML page; the popup posts the
//     OAuthLinkPayload (base64url JSON) to window.opener before closing itself.
//
// `kind` on the credential rows is the proto enum, which JSON-encodes
// as a number (1 = Discord, 2 = Google, 3 = Password). The numeric
// values come from the proto enum on the backend; the string aliases
// below are derived for UI use via `linkedProviderKindLabel`.

/** Canonical UI-facing labels for a linked credential. */
export type LinkedProviderKindLabel = "discord" | "google" | "password";

/**
 * Proto enum values. Verified against a real
 * `GET /api/auth/me/credentials` response from the Go backend
 * (Discord row `kind: 1`, Password row `kind: 2`). Google is
 * assumed to be `3` by proto-declaration order; if the backend
 * proves it otherwise, update here and the mapping below in tandem.
 */
export const LINKED_PROVIDER_KIND_NUMBER = {
  DISCORD: 1,
  PASSWORD: 2,
  GOOGLE: 3,
} as const;

export type LinkedProviderKindNumber =
  (typeof LINKED_PROVIDER_KIND_NUMBER)[keyof typeof LINKED_PROVIDER_KIND_NUMBER];

/**
 * `google.protobuf.Timestamp` as the Go backend JSON-encodes it.
 * A nil Timestamp serializes to `{}` (no fields), so the SPA treats
 * both `null`/`undefined` and an empty object as "unset". The string
 * shape is kept on the union because an earlier draft of this endpoint
 * (and a handful of tests) used ISO strings; consumers should treat
 * the wire as proto-shaped now.
 */
export interface ProtoTimestamp {
  seconds?: number | string;
  nanos?: number;
}

export type ProtoTimestampLike = ProtoTimestamp | string | null | undefined;

/**
 * One linked credential entry returned by the linked-credentials endpoint.
 * `kind` is the proto enum as JSON-encoded (number today, but kept
 * open to absorb future stringification). The `Payload` map is forwarded
 * verbatim — current rows include `DiscordId`, `GoogleSub`, `PasswordHash`.
 */
export interface LinkedProvider {
  id?: string;
  user_id?: string;
  kind: number | string;
  created_at?: ProtoTimestampLike;
  Payload?: Record<string, unknown>;
  identifier?: string;
  [key: string]: unknown;
}

/** One passkey entry returned alongside the credential list. */
export interface LinkedPasskey {
  id: string;
  user_id?: string;
  credential_id?: string;
  friendly_name?: string;
  created_at?: ProtoTimestampLike;
  last_used_at?: ProtoTimestampLike;
  revoked_at?: ProtoTimestampLike;
  [key: string]: unknown;
}

/** Response body for GET /api/auth/me/credentials. */
export interface LinkedCredentialsReply {
  credentials: LinkedProvider[];
  passkeys?: LinkedPasskey[];
}

/**
 * True when the value carries no information, i.e. the proto field was
 * never set. `null`/`undefined`, the empty-object encoding of a nil
 * proto Timestamp, and an empty string all count as unset.
 */
export function isProtoTimestampUnset(value: ProtoTimestampLike): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.length === 0;
  return Object.keys(value).length === 0;
}

/** A passkey is active when the backend hasn't revoked it. */
export function isLinkedPasskeyActive(p: LinkedPasskey): boolean {
  return isProtoTimestampUnset(p.revoked_at);
}

/**
 * Map a wire `kind` (number or string) to the UI label. Returns
 * `undefined` for unknown values so the caller can decide whether
 * to ignore, log, or render "other". String inputs are accepted for
 * backwards-compat with an earlier proto draft.
 */
export function linkedProviderKindLabel(
  kind: LinkedProvider["kind"],
): LinkedProviderKindLabel | undefined {
  if (typeof kind === "number") {
    if (kind === LINKED_PROVIDER_KIND_NUMBER.DISCORD) return "discord";
    if (kind === LINKED_PROVIDER_KIND_NUMBER.GOOGLE) return "google";
    if (kind === LINKED_PROVIDER_KIND_NUMBER.PASSWORD) return "password";
    return undefined;
  }
  if (typeof kind === "string") {
    const lower = kind.toLowerCase();
    if (lower === "discord") return "discord";
    if (lower === "google") return "google";
    if (lower === "password") return "password";
  }
  return undefined;
}

/**
 * Selectors that derive UI state from the credentials payload. The
 * selectors return `null` while the query is in flight so the
 * renderer can show "Loading..." instead of falsely claiming
 * "Not linked" for a fresh Discord-only account.
 */

export type CredentialLinkState = true | false | null;

/**
 * Pull the Discord snowflake out of a credential row's `Payload`
 * map. Returns `undefined` if the row isn't a Discord row, the
 * payload is missing, or the field isn't a string/number. Snowflake
 * math (default-avatar URL, creation date) lives on the
 * `DiscordLinkedAccount` class in `utils/DiscordLinkedAccount.ts`.
 */
export function discordIdFromCredential(
  credential: LinkedProvider,
): string | undefined {
  if (linkedProviderKindLabel(credential.kind) !== "discord") return undefined;
  const payload = credential.Payload;
  if (!payload || typeof payload !== "object") return undefined;
  const raw = (payload as Record<string, unknown>).DiscordId;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  return undefined;
}

export const linkedProvidersSelectors = {
  hasDiscord(reply: LinkedCredentialsReply | undefined): CredentialLinkState {
    if (!reply) return null;
    return reply.credentials.some(
      (c) => linkedProviderKindLabel(c.kind) === "discord",
    );
  },
  hasPassword(reply: LinkedCredentialsReply | undefined): CredentialLinkState {
    if (!reply) return null;
    return reply.credentials.some(
      (c) => linkedProviderKindLabel(c.kind) === "password",
    );
  },
  activePasskeyCount(reply: LinkedCredentialsReply | undefined): number | null {
    if (!reply) return null;
    return (reply.passkeys ?? []).filter(isLinkedPasskeyActive).length;
  },
};

/**
 * Payload the popup's /complete page posts to window.opener. The backend
 * base64url-encodes the JSON before placing it in the `payload` query
 * string, so the SPA base64url-decodes the message and parses it.
 *
 * `avatar_hash` is the Discord-specific avatar hint; `picture` is the
 * Google picture URL. Both are optional because the backend may not have
 * a fresh value at link time.
 */
export interface OAuthLinkPayload {
  provider: string;
  id: string;
  avatar_hash?: string;
  picture?: string;
  [key: string]: unknown;
}
