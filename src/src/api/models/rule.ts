// Rule types. Mirrors WerSu-Rest/src/controllers/rule_controller.go:
// POST /api/rules, GET /api/rules, GET /api/rules/:id,
// PATCH /api/rules/:id, DELETE /api/rules/:id.
// Scoping to a shelf uses the list filter
// attached_entity_type=shelf and attached_entity_id=:id.

export type AttachedEntityType = "directory" | "note" | "shelf";

export type RuleConditionType =
  | "always_true"
  | "note_content_contains"
  | "note_title_contains";

export type RuleActionType = "add_to_directory" | "add_tag";

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

export interface ListRulesQuery {
  event_type?: string;
  attached_entity_type?: string;
  attached_entity_id?: string;
  enabled_only?: boolean;
  creator_id?: string;
}

// Body for POST /api/rules. The backend marks the first six fields
// as required and returns 400 when any are missing.
export interface CreateRuleBody {
  event_type: string;
  attached_entity_type: AttachedEntityType;
  attached_entity_id: string;
  condition: Record<string, unknown>;
  action_type: RuleActionType;
  action_context: Record<string, unknown>;
  enabled?: boolean;
  creator_id?: string;
}

// Body for PATCH /api/rules/:id. Every field optional; only supplied
// keys are forwarded.
export interface UpdateRuleBody {
  event_type?: string;
  attached_entity_type?: AttachedEntityType;
  attached_entity_id?: string;
  condition?: Record<string, unknown>;
  action_type?: RuleActionType;
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
