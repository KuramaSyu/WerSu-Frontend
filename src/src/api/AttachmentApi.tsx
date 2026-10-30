import { th } from "zod/v4/locales";
import { BACKEND_BASE } from "../statics";
import type {
  AttachmentLinkBody,
  AttachmentMetadata,
  AttachmentTokenResponse,
  CreateAttachmentBody,
  DeleteAttachmentResponse,
  UpdateAttachmentRequest,
} from "./models/attachment";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import { ShareTokenBearerMixin } from "./shareToken";

/**
 * Interface for managing attachment operations.
 * Provides methods for creating, retrieving, deleting, and linking
 * attachments to a note (default) or to a user.
 *
 * @interface IAttachmentApi
 */
export interface IAttachmentApi {
  /**
   * Creates a new attachment with the given payload.
   * @param file - The file to be uploaded as an attachment.
   * @returns metadata of the created attachmentfile or null
   */
  createAttachment(file: File): Promise<AttachmentMetadata | null>;

  /**
   * Update metadata of an attachment - usually to rename it
   * @param key - The unique identifier for the attachment which should be updated
   * @param filename - The new filename for the attachment
   * @returns metadata of the created attachmentfile or null
   */
  updateAttachment(
    payload: UpdateAttachmentRequest,
  ): Promise<AttachmentMetadata | null>;

  /**
   * Retrieves the attachment file as a Blob based on its unique key.
   * @param key - The unique identifier for the attachment to retrieve.
   * @returns the attachment file as a Blob or null if not found
   */
  getAttachment(key: string): Promise<Blob | null>;

  /**
   * Fetches the metadata of an attachment using its unique key.
   * @param key - The unique identifier for the attachment whose metadata is to be retrieved.
   * @returns metadata of the attachment or null if not found
   */
  getAttachmentMetadata(key: string): Promise<AttachmentMetadata | null>;

  /**
   * Fetches a per-attachment JWT for a key that was not part of the
   * initial note token map (e.g. an attachment uploaded by another
   * collaborator while the note is open). The public image route and
   * `/attachments/<key>` link accept this token as the `jwt` query
   * parameter.
   * @param key - The unique identifier for the attachment.
   * @returns the scoped JWT or null if it could not be retrieved
   */
  getAttachmentToken(key: string): Promise<string | null>;

  /**
   * Deletes an attachment identified by its unique key.
   * @param key - The unique identifier for the attachment to be deleted.
   * @returns whether or not the deletion was successful, or null if an error occurred
   */
  deleteAttachment(key: string): Promise<DeleteAttachmentResponse | null>;

  /**
   * Links an existing attachment to a note (default), to a user, or
   * with no specific target - the optional `note_id` / `user_id`
   * fields may be omitted entirely.
   * @param payload - The data required to link the attachment, including the attachment key and optionally a note ID or user ID.
   * @returns the URL of the linked attachment or null if unsuccessful
   */
  linkAttachment(payload: AttachmentLinkBody): Promise<string | null>;

  /**
   * Unlinks an attachment from a note (default), from a user, or
   * with no specific target - the optional `note_id` / `user_id`
   * fields may be omitted entirely.
   * @param payload - The data required to unlink the attachment, including the attachment key and optionally a note ID or user ID.
   * @returns whether or not the unlinking was successful
   */
  unlinkAttachment(payload: AttachmentLinkBody): Promise<boolean>;

  /**
   * generates image link
   * @param key the attachment key
   * @param width the desired image width in pixels, or null for original width
   * @param height the desired image height in pixels, or null for original height
   * @param format the desired image format (e.g. "jpeg", "png", "webp"), or null for original format
   */
  generateImageLink(
    key: string,
    width: number | null,
    height: number | null,
    format: string | null,
  ): string;
}

export class TestAttachmentApi implements IAttachmentApi {
  async updateAttachment(
    payload: UpdateAttachmentRequest,
  ): Promise<AttachmentMetadata | null> {
    return {
      key: payload.key,
      filename: payload.filename ?? "test.txt",
      content_type: payload.content_type ?? "text/plain",
      size_bytes: 1234,
      created_at: new Date().toISOString(),
    };
  }

  async createAttachment(file: File): Promise<AttachmentMetadata> {
    return {
      key: "test-key",
      filename: file.name,
      content_type: file.type,
      size_bytes: 1234,
      created_at: new Date().toISOString(),
    };
  }

  async getAttachment(): Promise<Blob> {
    return new Blob(["test attachment"]);
  }

  async getAttachmentMetadata(key: string): Promise<AttachmentMetadata> {
    return {
      key,
      filename: "test.txt",
      content_type: "text/plain",
      size_bytes: 1234,
      created_at: new Date().toISOString(),
    };
  }

  async getAttachmentToken(): Promise<string> {
    return "test-attachment-jwt";
  }

  async deleteAttachment(): Promise<DeleteAttachmentResponse> {
    return { success: true };
  }

  async linkAttachment(): Promise<string | null> {
    return null;
  }

  async unlinkAttachment(): Promise<boolean> {
    return true;
  }

  generateImageLink(
    key: string,
    width: number | null,
    height: number | null,
    format: string | null,
  ): string {
    return `https://example.com/attachments/${key}`;
  }
}

export const ATTACHMENTS_API_PATH = "/api/attachments";

// Extends `ShareTokenBearerMixin` so the anonymous share JWT (installed
// on `/public/*` by `useShareTokenMode`) reaches the token endpoint.
// Logged-in users keep using the session cookie; the mixin collapses to
// `credentials: "include"` when no share provider is installed.
export class AttachmentApi
  extends ShareTokenBearerMixin
  implements IAttachmentApi
{
  private logError(urlPart: string, error: any): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  async updateAttachment(
    payload: UpdateAttachmentRequest,
  ): Promise<AttachmentMetadata | null> {
    const params = new URLSearchParams({
      key: encodeURIComponent(payload.key),
    });
    if (payload.filename) {
      params.append("filename", encodeURIComponent(payload.filename));
    }
    if (payload.content_type) {
      params.append("content_type", payload.content_type);
    }
    const url = `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/metadata/?${params.toString()}`;
    // `getFetchParameters` injects the public-share bearer token when a
    // share is active; falls back to the session cookie otherwise.
    const result = await fetch(url, {
      ...(await this.getFetchParameters("PATCH")),
    });
    if (result.ok) {
      return (await result.json().catch((e) => {
        this.logError(url, String(e));
        return null;
      })) as AttachmentMetadata;
    } else {
      this.logError(
        url,
        `Response not ok: ${result.status}; ${result.statusText}`,
      );
      throw new Error(
        `Failed to update attachment with key ${payload.key} and response status: ${result.status}`,
      );
    }
  }
  generateImageLink(
    key: string,
    width: number | null,
    height: number | null,
    format: string | null,
  ): string {
    const params = new URLSearchParams();

    // set same defaults
    width = width ?? 720;
    height = height ?? null; // since dimensions are unknown of image -> this could lead to distortion
    format = format ?? `webp`;

    // add to query
    if (width) params.append("width", width.toString());
    if (height) params.append("height", height.toString());
    if (format) params.append("format", format);
    params.append("key", encodeURIComponent(key));

    return `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/image?${params.toString()}`;
  }

  async createAttachment(file: File): Promise<AttachmentMetadata | null> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BACKEND_BASE}${ATTACHMENTS_API_PATH}`, {
      ...(await this.getFetchParameters("POST")),
      body: formData,
    });

    if (response.ok) {
      return response.json().catch((e) => {
        this.logError("/attachments", String(e));
        return null;
      });
    }

    this.logError(
      `${ATTACHMENTS_API_PATH}`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async getAttachment(key: string): Promise<Blob | null> {
    const response = await fetch(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/${key}`,
      await this.getFetchParameters("GET"),
    );

    if (response.ok) {
      return response.blob();
    }

    this.logError(
      `${ATTACHMENTS_API_PATH}/${key}`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async getAttachmentMetadata(key: string): Promise<AttachmentMetadata | null> {
    key = encodeURIComponent(key); // encode key to handle special characters
    const response = await fetch(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/metadata/?key=${key}`,
      await this.getFetchParameters("GET"),
    );

    if (response.ok) {
      return response.json().catch((e) => {
        this.logError(
          `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/metadata?key=${key}`,
          String(e),
        );
        return null;
      });
    }

    this.logError(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/metadata?key=${key}`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async getAttachmentToken(key: string): Promise<string | null> {
    const encodedKey = encodeURIComponent(key);
    const url = `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/token?key=${encodedKey}`;
    const params = await this.getFetchParameters("GET", {});
    const response = await fetch(url, params);

    if (response.ok) {
      const data = (await response.json().catch((e) => {
        this.logError(url, String(e));
        return null;
      })) as AttachmentTokenResponse | null;
      return data?.token ?? null;
    }

    this.logError(
      url,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async deleteAttachment(
    key: string,
  ): Promise<DeleteAttachmentResponse | null> {
    const response = await fetch(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(key)}`,
      await this.getFetchParameters("DELETE"),
    );

    if (response.ok) {
      return response.json().catch((e) => {
        this.logError(
          `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(key)}`,
          String(e),
        );
        throw new Error(
          `Failed to parse delete response for attachment with key ${key}`,
        );
      });
    }

    this.logError(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(key)}`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    throw new Error(`Failed to delete attachment with key ${key}`);
  }

  async linkAttachment(payload: AttachmentLinkBody): Promise<string | null> {
    const response = await fetch(`${BACKEND_BASE}/api/attachment-links`, {
      ...(await this.getFetchParameters("POST", {
        "Content-Type": "application/json",
      })),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // encode payload key since s3 path contains / which confuses the GIN REST API
      return `${BACKEND_BASE}/attachments/${encodeURIComponent(payload.attachment_key)}`;
    }

    this.logError(
      "/attachment-links",
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async unlinkAttachment(payload: AttachmentLinkBody): Promise<boolean> {
    const response = await fetch(`${BACKEND_BASE}/api/attachment-links`, {
      ...(await this.getFetchParameters("DELETE", {
        "Content-Type": "application/json",
      })),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return true;
    }

    this.logError(
      "/attachment-links",
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return false;
  }
}

// Register the default singleton + a typed token so consumers can resolve
// it via `getAttachmentApi()`.
//
// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const attachmentApiSingleton = new AttachmentApi();
apiRegistry.register(attachmentApiSingleton);
export const ATTACHMENT_API_TOKEN: ApiToken<AttachmentApi> = Symbol(
  "AttachmentApi",
) as ApiToken<AttachmentApi>;
apiRegistry.register(attachmentApiSingleton, ATTACHMENT_API_TOKEN);

/**
 * Resolve the registered `AttachmentApi` singleton.
 *
 * Throws if the API isn't registered — see `getNoteApi` for rationale.
 */
export function getAttachmentApi(): AttachmentApi {
  return apiRegistry.get<AttachmentApi>(ATTACHMENT_API_TOKEN);
}
