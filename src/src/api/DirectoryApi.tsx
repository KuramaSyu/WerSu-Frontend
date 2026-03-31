import { BACKEND_BASE } from "../statics";
import type {
  CreateDirectoryBody,
  DirectoryReply,
  PatchDirectoryBody,
} from "./models/directory.ts";

const DIRECTORIES_API_PATH = "/api/directories";

export interface ListDirectoriesQuery {
  parent_id?: string;
  limit?: number;
  offset?: number;
}

export interface IDirectoryApi {
  list(query?: ListDirectoriesQuery): Promise<DirectoryReply[]>;
  get(id: string): Promise<DirectoryReply | undefined>;
  create(payload: CreateDirectoryBody): Promise<DirectoryReply | undefined>;
  patch(payload: PatchDirectoryBody): Promise<DirectoryReply | undefined>;
  delete(id: string): Promise<DirectoryReply | undefined>;
}

export class DirectoryApi implements IDirectoryApi {
  private logError(urlPart: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${urlPart}:`,
      JSON.stringify(error),
    );
  }

  async list(query?: ListDirectoriesQuery): Promise<DirectoryReply[]> {
    const url = new URL(`${BACKEND_BASE}${DIRECTORIES_API_PATH}`);

    if (query?.parent_id !== undefined) {
      url.searchParams.append("parent_id", query.parent_id);
    }
    if (query?.limit !== undefined) {
      url.searchParams.append("limit", query.limit.toString());
    }
    if (query?.offset !== undefined) {
      url.searchParams.append("offset", query.offset.toString());
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      this.logError(
        `${DIRECTORIES_API_PATH}?${url.searchParams.toString()}`,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return [];
    }

    const directories = await response.json().catch((e) => {
      this.logError(
        `${DIRECTORIES_API_PATH}?${url.searchParams.toString()}`,
        e,
      );
      return null;
    });

    return (directories ?? []) as DirectoryReply[];
  }

  async get(id: string): Promise<DirectoryReply | undefined> {
    const urlPart = `${DIRECTORIES_API_PATH}/${id}`;

    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      this.logError(
        urlPart,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const directory = await response.json().catch((e) => {
      this.logError(urlPart, e);
      return null;
    });

    return directory ?? undefined;
  }

  async create(
    payload: CreateDirectoryBody,
  ): Promise<DirectoryReply | undefined> {
    return this.requestWithBody("POST", DIRECTORIES_API_PATH, payload);
  }

  async patch(
    payload: PatchDirectoryBody,
  ): Promise<DirectoryReply | undefined> {
    return this.requestWithBody("PATCH", DIRECTORIES_API_PATH, payload);
  }

  async delete(id: string): Promise<DirectoryReply | undefined> {
    return this.requestWithoutBody("DELETE", `${DIRECTORIES_API_PATH}/${id}`);
  }

  private async requestWithBody(
    method: "POST" | "PATCH",
    urlPart: string,
    payload: CreateDirectoryBody | PatchDirectoryBody,
  ): Promise<DirectoryReply | undefined> {
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.logError(
        urlPart,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const directory = await response.json().catch((e) => {
      this.logError(urlPart, e);
      return null;
    });

    return directory ?? undefined;
  }

  private async requestWithoutBody(
    method: "DELETE",
    urlPart: string,
  ): Promise<DirectoryReply | undefined> {
    const response = await fetch(`${BACKEND_BASE}${urlPart}`, {
      method,
      credentials: "include",
    });

    if (!response.ok) {
      this.logError(
        urlPart,
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const directory = await response.json().catch((e) => {
      this.logError(urlPart, e);
      return null;
    });

    return directory ?? undefined;
  }
}
