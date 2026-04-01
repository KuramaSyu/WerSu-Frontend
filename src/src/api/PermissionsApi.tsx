import { BACKEND_BASE } from "../statics";
import type {
  CreatePermissionBody,
  DeletePermissionBody,
  PermissionsReply,
  ReplacePermissionsBody,
} from "./models/search";

export type PermissionObjectQueryType = "note" | "directory";

export interface IPermissionsApi {
  get(
    object_type: PermissionObjectQueryType,
    object_id: string,
  ): Promise<PermissionsReply | undefined>;
  put(payload: ReplacePermissionsBody): Promise<PermissionsReply | undefined>;
  post(payload: CreatePermissionBody): Promise<PermissionsReply | undefined>;
  delete(payload: DeletePermissionBody): Promise<PermissionsReply | undefined>;
}

export class PermissionsApi implements IPermissionsApi {
  private logError(url_part: string, error: unknown): void {
    console.error(
      `Error fetching ${BACKEND_BASE}${url_part}:`,
      JSON.stringify(error),
    );
  }

  async get(
    object_type: PermissionObjectQueryType,
    object_id: string,
  ): Promise<PermissionsReply | undefined> {
    const url = new URL(`${BACKEND_BASE}/api/permissions`);
    url.searchParams.append("object_type", object_type);
    url.searchParams.append("object_id", object_id);

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      this.logError(
        "/api/permissions",
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const permissions = await response.json().catch((e) => {
      this.logError("/api/permissions", e);
      return null;
    });

    return permissions ?? undefined;
  }

  async put(
    payload: ReplacePermissionsBody,
  ): Promise<PermissionsReply | undefined> {
    return this.requestWithBody("PUT", payload);
  }

  async post(
    payload: CreatePermissionBody,
  ): Promise<PermissionsReply | undefined> {
    return this.requestWithBody("POST", payload);
  }

  async delete(
    payload: DeletePermissionBody,
  ): Promise<PermissionsReply | undefined> {
    return this.requestWithBody("DELETE", payload);
  }

  private async requestWithBody(
    method: "PUT" | "POST" | "DELETE",
    payload:
      | ReplacePermissionsBody
      | CreatePermissionBody
      | DeletePermissionBody,
  ): Promise<PermissionsReply | undefined> {
    const response = await fetch(`${BACKEND_BASE}/api/permissions`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.logError(
        "/api/permissions",
        `Response not ok: ${response.status}; ${response.statusText}`,
      );
      return undefined;
    }

    const permissions = await response.json().catch((e) => {
      this.logError("/api/permissions", e);
      return null;
    });

    return permissions ?? undefined;
  }
}
