/**
 * Rule types - request/response shapes for the authenticated
 * rule-management REST endpoints mounted under `/api/rules`
 * (CRUD). Rules drive the automation attached to a shelf or
 * directory; the wire format carries the full event/condition
 * payload even though the swagger leaves `CreateRuleBody` empty
 * (the backend reads the same field set the reply echoes back).
 */

/** Reply shape for a single rule row returned by
 *  `GET /api/rules`, `GET /api/rules/:id`, `POST /api/rules`,
 *  and `PATCH /api/rules/:id`. */
export interface RuleReply {
  id: string;
  event_type?: string;
  attached_entity_type?: string;
  attached_entity_id?: string;
  condition?: Record<string, unknown>;
  action_type?: string;
  action_context?: Record<string, unknown>;
  enabled?: boolean;
  creator_id?: string;
  created_at?: string;
  updated_at?: string;
}

/** Query for `GET /api/rules`. Every field is optional and
 *  combines with AND. `enabled_only` filters the list down to
 *  enabled rules. */
export interface ListRulesQuery {
  event_type?: string;
  attached_entity_type?: string;
  attached_entity_id?: string;
  enabled_only?: boolean;
  creator_id?: string;
}

/** Body for `POST /api/rules`. All fields are optional from the
 *  REST contract; the backend will reject the row if the
 *  resulting rule is incomplete. */
export interface CreateRuleBody {
  event_type?: string;
  attached_entity_type?: string;
  attached_entity_id?: string;
  condition?: Record<string, unknown>;
  action_type?: string;
  action_context?: Record<string, unknown>;
  enabled?: boolean;
}

/** Body for `PATCH /api/rules/:id`. Every field is optional;
 *  only the supplied fields are forwarded. */
export interface UpdateRuleBody {
  event_type?: string;
  attached_entity_type?: string;
  attached_entity_id?: string;
  condition?: Record<string, unknown>;
  action_type?: string;
  action_context?: Record<string, unknown>;
  enabled?: boolean;
}

export type ListRulesEndpointRequest = ListRulesQuery;
export type ListRulesEndpointReply = RuleReply[];

export type GetRuleByIdEndpointRequest = { id: string };
export type GetRuleByIdEndpointReply = RuleReply;

export type CreateRuleEndpointRequest = CreateRuleBody;
export type CreateRuleEndpointReply = RuleReply;

export type UpdateRuleEndpointRequest = { id: string; body: UpdateRuleBody };
export type UpdateRuleEndpointReply = RuleReply;

export type DeleteRuleEndpointRequest = { id: string };
export type DeleteRuleEndpointReply = void;
