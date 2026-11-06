// Pure helpers for the permission tick matrix. Kept out of the React
// component so they can be unit-tested without mounting MUI.

import type {
  PermissionObjectType,
  PermissionRelation,
  PermissionRelationshipReply,
  PermissionResourceType,
  PermissionSubjectRequest,
} from "../../api/models/search";

export interface PermissionColumn {
  relation: PermissionRelation;
  label: string;
  description: string;
  /** Basic columns replace each other; advanced columns are independent. */
  basic: boolean;
}

const RESOURCE_BASIC: readonly PermissionColumn[] = [
  {
    relation: "reader",
    label: "Read",
    description: "Can view the resource.",
    basic: true,
  },
  {
    relation: "writer",
    label: "Write",
    description: "Can view and edit the resource.",
    basic: true,
  },
  {
    relation: "admin",
    label: "Admin",
    description: "Can view, edit and manage sharing.",
    basic: true,
  },
];

const RESOURCE_ADVANCED: readonly PermissionColumn[] = [
  {
    relation: "grant_read",
    label: "Grant read",
    description: "Can pass read access on to other subjects.",
    basic: false,
  },
  {
    relation: "grant_write",
    label: "Grant write",
    description: "Can pass edit access on to other subjects.",
    basic: false,
  },
  {
    relation: "grant_admin",
    label: "Grant admin",
    description: "Can pass admin access on to other subjects.",
    basic: false,
  },
  {
    relation: "delegate_read",
    label: "Delegate read",
    description: "Can delegate read access to other subjects.",
    basic: false,
  },
  {
    relation: "delegate_write",
    label: "Delegate write",
    description: "Can delegate edit access to other subjects.",
    basic: false,
  },
  {
    relation: "delegate_admin",
    label: "Delegate admin",
    description: "Can delegate admin access to other subjects.",
    basic: false,
  },
];

const ROLE_BASIC: readonly PermissionColumn[] = [
  {
    relation: "grant_member",
    label: "Member",
    description: "Can use this role as a membership group.",
    basic: true,
  },
];

const ROLE_ADVANCED: readonly PermissionColumn[] = [
  {
    relation: "delegate_member",
    label: "Delegate member",
    description: "Can delegate membership management to other subjects.",
    basic: false,
  },
];

export function basicColumnsFor(
  objectType: PermissionResourceType,
): readonly PermissionColumn[] {
  return objectType === "role" ? ROLE_BASIC : RESOURCE_BASIC;
}

export function advancedColumnsFor(
  objectType: PermissionResourceType,
): readonly PermissionColumn[] {
  return objectType === "role" ? ROLE_ADVANCED : RESOURCE_ADVANCED;
}

export function allColumnsFor(
  objectType: PermissionResourceType,
): readonly PermissionColumn[] {
  return [...basicColumnsFor(objectType), ...advancedColumnsFor(objectType)];
}

/** Normalise protobuf enum names (`PERMISSION_OBJECT_TYPE_ROLE`) to short names. */
export function normalizePermissionObjectType(
  objectType: PermissionObjectType | string | undefined,
): string {
  if (!objectType) return "";
  return objectType
    .toLowerCase()
    .replace(/^permission_object_type_/, "")
    .replace(/^share_permission_/, "");
}

/** Stable identity for a matrix row. Role usersets include their relation. */
export function subjectKey(subject: PermissionSubjectRequest): string {
  return `${subject.object_type}:${subject.object_id}:${
    subject.optional_relation ?? ""
  }`;
}

export function subjectFromRelationship(
  relationship: PermissionRelationshipReply,
): PermissionSubjectRequest {
  const objectType = normalizePermissionObjectType(
    relationship.subject.object_type,
  );
  const isRole = objectType === "role";
  return {
    object_type: isRole ? "role" : "user",
    object_id: relationship.subject.object_id,
    ...(isRole
      ? {
          optional_relation:
            (relationship.subject.optional_relation as "member" | undefined) ??
            "member",
        }
      : {}),
  };
}

export function relationshipsForSubject(
  relationships: readonly PermissionRelationshipReply[],
  subject: PermissionSubjectRequest,
): PermissionRelationshipReply[] {
  return relationships.filter(
    (relationship) =>
      subjectKey(subjectFromRelationship(relationship)) === subjectKey(subject),
  );
}

export function hasRelation(
  relationships: readonly PermissionRelationshipReply[],
  subject: PermissionSubjectRequest,
  relation: PermissionRelation,
): boolean {
  return relationshipsForSubject(relationships, subject).some(
    (relationship) => relationship.relation === relation,
  );
}

export function isBasicRelation(
  objectType: PermissionResourceType,
  relation: string,
): boolean {
  return basicColumnsFor(objectType).some(
    (column) => column.relation === relation,
  );
}
