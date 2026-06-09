import type { Note, PermissionRelationshipReply } from "../api/models/search";

/**
 * replaces all parent relations in the permissions and adds the new one.
 * used to replace note inplace without fetching again
 * @param note the note to add a note#parent_directory@directory relation
 * @param directoryId the directoryId of the subject in the relation
 * @returns the note with the added permission
 */
export function updateNoteParentDirectory(
  note: Note,
  directoryId?: string,
): Note {
  const existingPermissions = note.permissions ?? [];

  /** check permission is note#parent_directory@directory or directory#parent@directory */
  const isParentRelation = (permission: PermissionRelationshipReply) => {
    const isParentRelation =
      permission.relation === "parent" ||
      permission.relation === "parent_directory";
    const isDirectorySubject =
      permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY";
    return isParentRelation && isDirectorySubject;
  };

  const parentRelations = existingPermissions.filter((permission) => {
    isParentRelation(permission);
  });

  // If no directory is provided, clear all parent relations (root).
  if (!directoryId) {
    const cleanedPermissions = existingPermissions.filter(
      (permission) => !isParentRelation(permission),
    );
    note.permissions = cleanedPermissions;
    return note;
  }

  const alreadyHasThisParent = parentRelations.some(
    (relation) =>
      relation.subject.object_id === directoryId && isParentRelation(relation),
  );

  if (alreadyHasThisParent) {
    return note;
  }

  const nextParentRelation: PermissionRelationshipReply = {
    relation: "parent_directory",
    resource: {
      object_id: note.id,
      object_type: "PERMISSION_OBJECT_TYPE_NOTE",
    },
    subject: {
      object_id: directoryId,
      object_type: "PERMISSION_OBJECT_TYPE_DIRECTORY",
    },
  };

  note.permissions.push(nextParentRelation);
  return note;
}
