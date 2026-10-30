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
  jwt: string | null;

  constructor(api: IAttachmentApi) {
    this.api = api;
    this.width = null;
    this.height = null;
    this.format = null;
    this.as_html = false;
    this.as_markdown = false;
    this.contentType = "image/*";
    this.jwt = null;
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

  public setJwt(jwt: string | null): AttachmentLinkBuilder {
    this.jwt = jwt;
    return this;
  }

  private getHtml(link: string): string {
    return `<img src="${link}" alt="Attachment Image" />`;
  }

  private getMarkdown(link: string): string {
    return `![Attachment Image](${link})`;
  }

  private appendJwt(link: string): string {
    if (!this.jwt) return link;
    const separator = link.includes("?") ? "&" : "?";
    return `${link}${separator}jwt=${encodeURIComponent(this.jwt)}`;
  }

  /**
   * The backend's `GET /attachments/image` accepts a per-attachment JWT
   * as the `key` query parameter. It unpacks the token's `att` claim to
   * resolve the real object and bypasses the SpiceDB permission check.
   * That is what lets a public-share viewer, who has no `view` tuple on
   * the attachment, load the image.
   *
   * `appendJwt` still adds the same token under `jwt=` so
   * `UserFromContext` can authenticate the request before `GetImage`
   * reaches the `key` handling. Passing it in only one of the two
   * parameters (the old behaviour) made public images fail: the raw key
   * triggered the permission check while the token sat unused in
   * `jwt`.
   */
  private replaceKeyWithJwt(link: string): string {
    if (!this.jwt) return link;
    const keyParam = /([?&])key=[^&]*/;
    if (!keyParam.test(link)) return link;
    return link.replace(keyParam, `$1key=${encodeURIComponent(this.jwt)}`);
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
      // Images get the JWT as the `key` so the backend bypasses the
      // permission check for public viewers; the raw key is recoverable
      // from the token's `att` claim.
      link = this.replaceKeyWithJwt(link);
    } else {
      link = `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=${encodeURIComponent(key)}`;
    }

    link = this.appendJwt(link);

    if (this.as_html) {
      return this.getHtml(link);
    }

    if (this.as_markdown) {
      return this.getMarkdown(link);
    }

    return link;
  }
}
