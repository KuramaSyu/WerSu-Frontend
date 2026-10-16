// Wire shapes for the linked-providers surface and the OAuth-link popup payload.
//
// Two endpoints the SPA consumes:
//   - GET  /api/auth/me/credentials         -> LinkedCredentialsReply
//   - GET  /api/auth/link/{p}/complete      -> HTML page; the popup posts the
//     OAuthLinkPayload (base64url JSON) to window.opener before closing itself.

/**
 * Canonical kinds returned in LinkedCredentialsReply.credentials[].kind.
 * The proto maps onto these exact strings; new values are surfaced via
 * `LinkedProvider.kind` as raw strings, so we narrow with an `as const`
 * table rather than a closed union.
 */
export const LINKED_PROVIDER_KIND = {
  DISCORD: "discord",
  GOOGLE: "google",
  PASSWORD: "password",
} as const;

export type LinkedProviderKind =
  (typeof LINKED_PROVIDER_KIND)[keyof typeof LINKED_PROVIDER_KIND];

/**
 * One linked credential entry returned by the linked-credentials endpoint.
 * Today the SPA only needs `kind`; the rest is forwarded from the proto
 * (created_at, identifier, etc.) and left open via the index signature so
 * the SPA does not break when the proto grows new fields.
 */
export interface LinkedProvider {
  kind: string;
  identifier?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** One passkey entry returned alongside the credential list. */
export interface LinkedPasskey {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

/** Response body for GET /api/auth/me/credentials. */
export interface LinkedCredentialsReply {
  credentials: LinkedProvider[];
  passkeys?: LinkedPasskey[];
}

/** A passkey is active when the backend hasn't revoked it. */
export function isLinkedPasskeyActive(p: LinkedPasskey): boolean {
  return p.revoked_at === undefined;
}

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
