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
   * @returns whether or not the linking was successful
   */
  linkAttachment(payload: AttachmentLinkBody): Promise<boolean>;

  /**
   * Unlinks an attachment from a note using the provided payload, which includes the attachment key and note ID.
   * @param payload - The data required to unlink the attachment, including the attachment key and the note ID.
   * @returns whether or not the unlinking was successful
   */
  unlinkAttachment(payload: AttachmentLinkBody): Promise<boolean>;
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

  async linkAttachment(): Promise<boolean> {
    return true;
  }

  async unlinkAttachment(): Promise<boolean> {
    return true;
  }
}

const ATTACHMENTS_API_PATH = "/api/attachments";

export class AttachmentApi implements IAttachmentApi {
  private logError(urlPart: string, error: any): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
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
    const response = await fetch(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/${key}/metadata`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    if (response.ok) {
      return response.json().catch((e) => {
        this.logError(`${ATTACHMENTS_API_PATH}/${key}/metadata`, String(e));
        return null;
      });
    }

    this.logError(
      `${ATTACHMENTS_API_PATH}/${key}/metadata`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async deleteAttachment(
    key: string,
  ): Promise<DeleteAttachmentResponse | null> {
    const response = await fetch(
      `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/${key}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (response.ok) {
      return response.json().catch((e) => {
        this.logError(`${ATTACHMENTS_API_PATH}/${key}`, String(e));
        return null;
      });
    }

    this.logError(
      `${ATTACHMENTS_API_PATH}/${key}`,
      `Response not ok: ${response.status}; ${response.statusText}`,
    );
    return null;
  }

  async linkAttachment(payload: AttachmentLinkBody): Promise<boolean> {
    const response = await fetch(`${BACKEND_BASE}/api/attachment-links`, {
      method: "POST",
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
