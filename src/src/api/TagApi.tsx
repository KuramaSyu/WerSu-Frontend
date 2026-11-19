import { BACKEND_BASE } from "../statics";
import type {
  CreateTagBody,
  DeleteTagReply,
  TagReply,
  UpdateTagBody,
} from "./models/tag";
import { ShareTokenBearerMixin } from "./shareToken";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import { UserError } from "./models/UserError";

const TAGS_API_PATH = "/api/tags";

export interface ITagApi {
  list(): Promise<TagReply[]>;
  get(id: string): Promise<TagReply | undefined>;
  create(payload: CreateTagBody): Promise<TagReply>;
  patch(id: string, payload: UpdateTagBody): Promise<TagReply>;
  /** Deletes a tag; resolves true when a row was actually removed. */
  delete(id: string): Promise<boolean>;
}

/**
 * REST client for the global tag taxonomy.
 *
 * Extends `ShareTokenBearerMixin` so tag reads made from a public
 * share route can attach the anonymous share JWT when one is active.
 */
export class TagApi extends ShareTokenBearerMixin implements ITagApi {
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  private async authHeaders(
    base: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    return { ...base, ...(await this.resolveShareAuthHeader()) };
  }

  private async buildUserError(
    response: Response,
    title: string,
  ): Promise<UserError> {
    const detail = await response.text().catch(() => "");
    return new UserError(
      title,
      detail || response.statusText || "Unknown error",
      response.status,
    );
  }

  async list(): Promise<TagReply[]> {
    const response = await fetch(`${BACKEND_BASE}${TAGS_API_PATH}`, {
      method: "GET",
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      this.logError(
        TAGS_API_PATH,
        `Response not ok: ${response.status}; ${response.statusText}; ${detail}`,
      );
      throw new UserError(
        "Failed to load tags",
        detail || response.statusText || "Unknown error",
        response.status,
      );
    }

    const tags = await response.json().catch((error) => {
      this.logError(TAGS_API_PATH, error);
      return null;
    });

    return (tags ?? []) as TagReply[];
  }

  async get(id: string): Promise<TagReply | undefined> {
    const urlPart = `${TAGS_API_PATH}/${encodeURIComponent(id)}`;
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method: "GET",
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to load tag");
    }

    const tag = await response.json().catch((error) => {
      this.logError(urlPart, error);
      return null;
    });

    return (tag ?? undefined) as TagReply | undefined;
  }

  async create(payload: CreateTagBody): Promise<TagReply> {
    return this.requestWithBody("POST", TAGS_API_PATH, payload);
  }

  async patch(id: string, payload: UpdateTagBody): Promise<TagReply> {
    const urlPart = `${TAGS_API_PATH}/${encodeURIComponent(id)}`;
    return this.requestWithBody("PATCH", urlPart, payload);
  }

  async delete(id: string): Promise<boolean> {
    const urlPart = `${TAGS_API_PATH}/${encodeURIComponent(id)}`;
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method: "DELETE",
      credentials: "include",
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      throw await this.buildUserError(response, "Failed to delete tag");
    }

    const reply = await response.json().catch((error) => {
      this.logError(urlPart, error);
      return null;
    });

    return Boolean((reply as DeleteTagReply | null)?.deleted);
  }

  private async requestWithBody(
    method: "POST" | "PATCH",
    urlPart: string,
    payload: CreateTagBody | UpdateTagBody,
  ): Promise<TagReply> {
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method,
      credentials: "include",
      headers: await this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await this.buildUserError(
        response,
        method === "POST" ? "Failed to create tag" : "Failed to update tag",
      );
    }

    const tag = await response.json().catch((error) => {
      this.logError(urlPart, error);
      return null;
    });

    if (tag === null) {
      throw new UserError(
        method === "POST" ? "Failed to create tag" : "Failed to update tag",
        "The server returned an empty response.",
        response.status,
      );
    }

    return tag as TagReply;
  }
}

// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const tagApiSingleton = new TagApi();
apiRegistry.register(tagApiSingleton);

export const TAG_API_TOKEN: ApiToken<TagApi> = Symbol(
  "TagApi",
) as ApiToken<TagApi>;

apiRegistry.register(tagApiSingleton, TAG_API_TOKEN);

export function getTagApi(): TagApi {
  return apiRegistry.get<TagApi>(TAG_API_TOKEN);
}
