import { BACKEND_BASE } from "../../statics";
import { ATTACHMENTS_API_PATH, type IAttachmentApi } from "../AttachmentApi";

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
  contentType: string | null;

  constructor(api: IAttachmentApi) {
    this.api = api;
    this.width = null;
    this.height = null;
    this.format = null;
    this.as_html = false;
    this.as_markdown = false;
    this.contentType = "image/*";
  }

  public asHtml(): AttachmentLinkBuilder {
    this.as_html = true;
    return this;
  }

  public setContentType(contentType: string): AttachmentLinkBuilder {
    this.contentType = contentType;
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
    var link: string;
    if (this.contentType && this.contentType.startsWith("image/")) {
      link = this.api.generateImageLink(
        key,
        this.width,
        this.height,
        this.format,
      );
    } else {
      link = `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(key)}`;
    }

    if (this.as_html) {
      return this.getHtml(link);
    }

    if (this.as_markdown) {
      return this.getMarkdown(link);
    }

    return link;
  }
}
