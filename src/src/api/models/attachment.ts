export interface AttachmentMetadata {
  key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface CreateAttachmentBody {
  filename: string;
  mime_type: string;
  data: string; // base64 or whatever your backend expects
}

export interface AttachmentLinkBody {
  attachment_key: string;
  note_id: string;
}

export interface DeleteAttachmentResponse {
  success: boolean;
}

export interface UpdateAttachmentRequest {
  key: string;
  filename?: string;
  mime_type?: string;
}
