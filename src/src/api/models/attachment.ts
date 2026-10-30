export interface AttachmentMetadata {
  key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface CreateAttachmentBody {
  filename: string;
  content_type: string;
  data: string; // base64 or whatever your backend expects
}

/**
 * Body for `/api/attachment-links`. At least one of `note_id` /
 * `user_id` SHOULD be set, but the backend accepts both being
 * absent too (link with no target) -- so both are optional here.
 * Note wins over user when both happen to be present.
 */
export interface AttachmentLinkBody {
  attachment_key: string;
  note_id?: string;
  user_id?: string;
}

export interface DeleteAttachmentResponse {
  success: boolean;
}

/**
 * Response of `GET /api/attachments/token?key=<key>`. The `token` is an
 * HS256 JWT scoped to a single attachment (iss="WerSu gRPC", sub=<user id>,
 * att=<key>, 15 min TTL). The public image route accepts it as the `jwt`
 * query parameter.
 */
export interface AttachmentTokenResponse {
  token: string;
}

export interface UpdateAttachmentRequest {
  key: string;
  filename?: string;
  content_type?: string;
}
