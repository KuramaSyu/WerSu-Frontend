import { BACKEND_BASE } from "../statics";
import type {
  AttachmentLinkBody,
  AttachmentMetadata,
  CreateAttachmentBody,
  DeleteAttachmentResponse,
} from "./models/attachment";

/**
 * Interface for managing attachment operations.
 * Provides methods for creating, retrieving, deleting, and linking attachments.
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
   * Deletes an attachment identified by its unique key.
   * @param key - The unique identifier for the attachment to be deleted.
   * @returns whether or not the deletion was successful, or null if an error occurred
   */
  deleteAttachment(key: string): Promise<DeleteAttachmentResponse | null>;

  /**
   * Links an existing attachment to a note using the provided payload, which includes the attachment key and note ID.
   * @param payload - The data required to link the attachment, including the attachment key and the note ID.
   * @returns the URL of the linked attachment or null if unsuccessful
   */
  linkAttachment(payload: AttachmentLinkBody): Promise<string | null>;

  /**
   * Unlinks an attachment from a note using the provided payload, which includes the attachment key and note ID.
   * @param payload - The data required to unlink the attachment, including the attachment key and the note ID.
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
  async createAttachment(file: File): Promise<AttachmentMetadata> {
    return {
      key: "test-key",
      filename: file.name,
      mime_type: file.type,
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
      mime_type: "text/plain",
      size_bytes: 1234,
      created_at: new Date().toISOString(),
    };
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

const ATTACHMENTS_API_PATH = "/api/attachments";

/**
 * Simple heler to build image to prevent function calls with 20x null
 */
export class AttachmentLinkBuilder {
  private api: IAttachmentApi;
  width: number | null;
  height: number | null;
  format: string | null;
  as_html: boolean;
  as_markdown: boolean;

  constructor(api: IAttachmentApi) {
    this.api = api;
    this.width = null;
    this.height = null;
    this.format = null;
    this.as_html = false;
    this.as_markdown = false;
  }

  public asHtml(): AttachmentLinkBuilder {
    this.as_html = true;
    return this;
  }

  public asMarkdown(): AttachmentLinkBuilder {
    this.as_markdown = true;
    return this;
  }

  public setWidth(width: number | null): AttachmentLinkBuilder {
    this.width = width;
    return this;
  }

  public setHeight(height: number | null): AttachmentLinkBuilder {
    this.height = height;
    return this;
  }

  public setFormat(format: string | null): AttachmentLinkBuilder {
    this.format = format;
    return this;
  }

  private getHtml(link: string): string {
    return `<img src="${link}" alt="Attachment Image" />`;
  }

  private getMarkdown(link: string): string {
    return `![Attachment Image](${link})`;
  }

  public getLink(key: string): string {
    /**builds the link with the given parameters */
    const link = this.api.generateImageLink(
      key,
      this.width,
      this.height,
      this.format,
    );

    if (this.as_html) {
      return this.getHtml(link);
    }

    if (this.as_markdown) {
      return this.getMarkdown(link);
    }

    return link;
  }
}

export class AttachmentApi implements IAttachmentApi {
  private logError(urlPart: string, error: any): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
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
      method: "POST",
      credentials: "include",
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
      {
        method: "GET",
        credentials: "include",
      },
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
      {
        method: "GET",
        credentials: "include",
      },
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

  async deleteAttachment(
    key: string,
  ): Promise<DeleteAttachmentResponse | null> {
    const response = await fetch(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(key)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
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
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
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
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
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
