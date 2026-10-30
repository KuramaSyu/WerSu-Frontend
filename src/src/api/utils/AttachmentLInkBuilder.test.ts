import { describe, expect, it } from "vitest";
import { AttachmentLinkBuilder } from "./AttachmentLInkBuilder";
import { BACKEND_BASE } from "../../statics";
import { ATTACHMENTS_API_PATH } from "../AttachmentApi";
import type { IAttachmentApi } from "../AttachmentApi";

/**
 * Minimal stub of `IAttachmentApi` that only fulfils the methods the
 * builder calls. Keeps the test focused on `setJwt` + `getLink`
 * behaviour, not on the real `AttachmentApi` network surface.
 */
function makeStubApi(
  generated: (key: string) => string = (key) =>
    `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/image?key=${encodeURIComponent(key)}`,
): IAttachmentApi {
  return {
    async createAttachment() {
      return null;
    },
    async updateAttachment() {
      return null;
    },
    async getAttachment() {
      return null;
    },
    async getAttachmentMetadata() {
      return null;
    },
    async getAttachmentToken() {
      return null;
    },
    async deleteAttachment() {
      return null;
    },
    async linkAttachment() {
      return null;
    },
    async unlinkAttachment() {
      return true;
    },
    generateImageLink(key) {
      return generated(key);
    },
  };
}

describe("AttachmentLinkBuilder.setJwt", () => {
  it("omits jwt= when not set", () => {
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api).getLink("att-1");
    expect(link).not.toContain("jwt=");
  });

  it("appends jwt= to an image link as a query parameter", () => {
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api)
      .setJwt("abc.def.ghi")
      .getLink("att-1");
    expect(link).toContain("jwt=abc.def.ghi");
  });

  it("uses & when the generated URL already has query params", () => {
    const api = makeStubApi(
      (key) =>
        `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/image?key=${encodeURIComponent(key)}&width=720&format=webp`,
    );
    const link = new AttachmentLinkBuilder(api).setJwt("tok").getLink("att-1");
    expect(link).toContain("&jwt=tok");
    expect(link).not.toContain("?&");
  });

  it("uses ? when the URL has no existing query string", () => {
    // Non-image content type takes the raw-attachments path.
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api)
      .setContentType("application/pdf")
      .setJwt("tok")
      .getLink("att-1");
    expect(
      link.startsWith(`${BACKEND_BASE}${ATTACHMENTS_API_PATH}/?key=`),
    ).toBe(true);
    expect(link).toContain("&jwt=tok");
  });

  it("URL-encodes the JWT value", () => {
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api)
      .setJwt("a/b+c=d")
      .getLink("att-1");
    expect(link).toContain("jwt=a%2Fb%2Bc%3Dd");
  });

  it("wraps a JWT-bearing URL in <img src=...> for asHtml()", () => {
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api)
      .setJwt("tok")
      .asHtml()
      .getLink("att-1");
    expect(link).toMatch(/^<img src=".*jwt=tok".*\/>/);
  });

  it("wraps a JWT-bearing URL in ![...](...) for asMarkdown()", () => {
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api)
      .setJwt("tok")
      .asMarkdown()
      .getLink("att-1");
    expect(link).toMatch(/^!\[Attachment Image\]\(.*jwt=tok.*\)$/);
  });

  it("can be cleared again with setJwt(null)", () => {
    const api = makeStubApi();
    const builder = new AttachmentLinkBuilder(api).setJwt("tok");
    expect(builder.getLink("att-1")).toContain("jwt=tok");
    builder.setJwt(null);
    expect(builder.getLink("att-1")).not.toContain("jwt=");
  });
});

describe("AttachmentLinkBuilder public-share image auth", () => {
  // The backend's GET /attachments/image resolves a per-attachment JWT
  // passed as the `key` query parameter (unpacking its `att` claim and
  // bypassing the permission check). `jwt` remains the caller-auth
  // parameter read by `UserFromContext`. Regression guard: the old code
  // put the JWT only in `jwt`, so public images hit the permission check
  // with the raw key and failed.
  it("replaces the key query parameter with the JWT for image links", () => {
    const api = makeStubApi(
      (key) =>
        `${BACKEND_BASE}${ATTACHMENTS_API_PATH}/image?width=720&format=webp&key=${encodeURIComponent(key)}`,
    );
    const link = new AttachmentLinkBuilder(api).setJwt("tok").getLink("att-1");

    const url = new URL(link);
    expect(url.searchParams.get("key")).toBe("tok");
    expect(url.searchParams.get("jwt")).toBe("tok");
  });

  it("keeps the raw key for non-image (download) links", () => {
    const api = makeStubApi();
    const link = new AttachmentLinkBuilder(api)
      .setContentType("application/pdf")
      .setJwt("tok")
      .getLink("att-1");

    const url = new URL(link);
    expect(url.searchParams.get("key")).toBe("att-1");
    expect(url.searchParams.get("jwt")).toBe("tok");
  });
});
