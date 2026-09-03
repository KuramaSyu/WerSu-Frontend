/*
  Rule REST client for the GoToHell API.

  Mirrors the `/api/rules` surface defined in
  `WerSuDeF-Rest-Api/src/docs/swagger.json`. The shape follows
  the same `AbstractRuleApi` / `RestRuleApi` split used by
  `SharingApi`: tests can swap the implementation without
  touching the call sites, and `requestJson` handles error
  parsing uniformly.
*/

import { BACKEND_BASE } from "../statics";
import type {
  CreateRuleEndpointReply,
  CreateRuleEndpointRequest,
  DeleteRuleEndpointRequest,
  GetRuleByIdEndpointReply,
  GetRuleByIdEndpointRequest,
  ListRulesEndpointReply,
  ListRulesEndpointRequest,
  UpdateRuleEndpointReply,
  UpdateRuleEndpointRequest,
} from "./models/rule";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * REST surface for the authenticated rule-management endpoints.
 * Implementation lives in :class:`RestRuleApi`; tests and
 * plugin code can pass an alternative implementation through
 * the registry.
 */
export interface RuleApi {
  /** List rules with optional filters. */
  listRules(request: ListRulesEndpointRequest): Promise<ListRulesEndpointReply>;

  /** Fetch a single rule by ID. */
  getRuleById(
    request: GetRuleByIdEndpointRequest,
  ): Promise<GetRuleByIdEndpointReply>;

  /** Create one rule. */
  createRule(
    request: CreateRuleEndpointRequest,
  ): Promise<CreateRuleEndpointReply>;

  /** Update one rule. Only the supplied fields are forwarded. */
  updateRule(
    request: UpdateRuleEndpointRequest,
  ): Promise<UpdateRuleEndpointReply>;

  /** Delete one rule. */
  deleteRule(request: DeleteRuleEndpointRequest): Promise<void>;
}

export abstract class AbstractRuleApi implements RuleApi {
  abstract listRules(
    request: ListRulesEndpointRequest,
  ): Promise<ListRulesEndpointReply>;
  abstract getRuleById(
    request: GetRuleByIdEndpointRequest,
  ): Promise<GetRuleByIdEndpointReply>;
  abstract createRule(
    request: CreateRuleEndpointRequest,
  ): Promise<CreateRuleEndpointReply>;
  abstract updateRule(
    request: UpdateRuleEndpointRequest,
  ): Promise<UpdateRuleEndpointReply>;
  abstract deleteRule(request: DeleteRuleEndpointRequest): Promise<void>;
}

export class RestRuleApi extends AbstractRuleApi {
  async listRules(
    request: ListRulesEndpointRequest,
  ): Promise<ListRulesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/rules${toQueryString(request)}`;
    return await requestJson<ListRulesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getRuleById(
    request: GetRuleByIdEndpointRequest,
  ): Promise<GetRuleByIdEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/rules/${encodeURIComponent(request.id)}`;
    return await requestJson<GetRuleByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async createRule(
    request: CreateRuleEndpointRequest,
  ): Promise<CreateRuleEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/rules`;
    return await requestJson<CreateRuleEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async updateRule(
    request: UpdateRuleEndpointRequest,
  ): Promise<UpdateRuleEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/rules/${encodeURIComponent(request.id)}`;
    return await requestJson<UpdateRuleEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
  }

  async deleteRule(request: DeleteRuleEndpointRequest): Promise<void> {
    const endpoint = `${BACKEND_BASE}/api/rules/${encodeURIComponent(request.id)}`;
    await requestJson<void>(endpoint, {
      method: "DELETE",
    });
  }
}

export const ruleApi: RuleApi = new RestRuleApi();

// Register the concrete REST singleton under a typed token so consumers
// can resolve it via `getRuleApi()`. The bare `ruleApi` export above
// stays for backward compatibility with the rest of the call sites.
apiRegistry.register(ruleApi as RestRuleApi);
export const RULE_API_TOKEN: ApiToken<RestRuleApi> = Symbol(
  "RestRuleApi",
) as ApiToken<RestRuleApi>;
apiRegistry.register(ruleApi as RestRuleApi, RULE_API_TOKEN);

/**
 * Resolve the registered `RestRuleApi` singleton.
 *
 * Throws if the API isn't registered - see `getNoteApi` for rationale.
 */
export function getRuleApi(): RestRuleApi {
  return apiRegistry.get<RestRuleApi>(RULE_API_TOKEN);
}
