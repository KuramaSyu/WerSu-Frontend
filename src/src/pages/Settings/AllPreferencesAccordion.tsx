import { Fragment } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { CUSTOM_THEMES_PREFERENCE_KEY } from "../../models/customThemes";
import { useRolesByUser } from "../../api/queries/roleQueries";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { useUserStore } from "../../zustand/userStore";
import { PreferenceRowEditor } from "./PreferenceRowEditor";

/**
 * Every preference key the frontend knows about. The default row
 * (`key` omitted) carries the active theme; `custom-themes` carries
 * generated themes. Add new keys here so they surface in the
 * developer view automatically.
 */
const PREFERENCE_KEYS: readonly { key?: string; label: string }[] = [
  { key: undefined, label: "default" },
  { key: CUSTOM_THEMES_PREFERENCE_KEY, label: CUSTOM_THEMES_PREFERENCE_KEY },
];

/**
 * Developer tool: lists every known `/api/preferences` row across the
 * user, the selected shelf, and the caller's roles. Each row is an
 * independent editor with save/reload/delete.
 *
 * There is no "list rows" endpoint on the backend, so the set is derived
 * from the keys the frontend uses plus the current targets.
 */
export const AllPreferencesAccordion: React.FC = () => {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const shelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  // Role listing is admin-gated on the backend; a failure just hides the
  // role rows, so do not retry.
  const { data: roles } = useRolesByUser(
    { subject_user_id: userId ?? "" },
    { retry: false },
  );

  if (userId === null) {
    return (
      <Alert severity="info">
        Sign in to inspect and edit your cloud preferences.
      </Alert>
    );
  }

  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">All preferences</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Every known <code>/api/preferences</code> row for your account,
            the selected shelf, and your roles. Save replaces a row wholesale;
            delete drops it.
          </Typography>

          <Typography variant="overline">User · {userId}</Typography>
          {PREFERENCE_KEYS.map(({ key, label }) => (
            <PreferenceRowEditor
              key={`user-${label}`}
              scope="user"
              targetId={userId}
              prefKey={key}
              label={label}
            />
          ))}

          <Typography variant="overline">
            Shelf {shelfId !== null ? `· ${shelfId}` : ""}
          </Typography>
          {shelfId === null ? (
            <Alert severity="info">
              Select a shelf to inspect its preference rows.
            </Alert>
          ) : (
            PREFERENCE_KEYS.map(({ key, label }) => (
              <PreferenceRowEditor
                key={`shelf-${shelfId}-${label}`}
                scope="shelf"
                targetId={shelfId}
                prefKey={key}
                label={label}
              />
            ))
          )}

          {roles !== undefined && roles.length > 0 ? (
            <>
              <Typography variant="overline">Roles</Typography>
              {roles.map((role) => (
                <Fragment key={role.id}>
                  <Typography variant="subtitle2">
                    {role.name ?? role.id}
                  </Typography>
                  {PREFERENCE_KEYS.map(({ key, label }) => (
                    <PreferenceRowEditor
                      key={`role-${role.id}-${label}`}
                      scope="role"
                      targetId={role.id}
                      prefKey={key}
                      label={label}
                    />
                  ))}
                </Fragment>
              ))}
            </>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
