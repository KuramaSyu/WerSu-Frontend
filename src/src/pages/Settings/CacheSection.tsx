import { Button, Stack, Typography } from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { queryClient } from "../../api/queryClient";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import {
  WIPE_ALL_SENTINEL,
  WIPE_ALL_EXCEPT_USERS_SENTINEL,
  queryCacheGroups,
  wipeQueryGroups,
} from "./queryCacheKeys";
import { SettingsGroup, SettingsRow } from "./SettingsRow";

/**
 * Body of the Settings `Cache` category. Wipes run through the shared `ConfirmationModal`,
 * use `queryClient.removeQueries(...)` so observers re-fire on next render.
 */
export const CacheSection: React.FC = () => {
  const { setMessage } = useInfoStore();

  const performWipe = (ids: readonly string[]) => {
    const removed = wipeQueryGroups(queryClient, ids);
    const isAll = ids.includes(WIPE_ALL_SENTINEL);
    const isAllExceptUsers = ids.includes(WIPE_ALL_EXCEPT_USERS_SENTINEL);
    const subject = isAll
      ? "every wipeable cache"
      : isAllExceptUsers
        ? "every wipeable cache except user"
        : ids
            .map((id) => queryCacheGroups.find((g) => g.id === id)?.label ?? id)
            .join(", ");
    const noun = removed === 1 ? "entry" : "entries";
    setMessage(
      new SnackbarUpdateImpl(
        `Wiped ${removed} cached ${noun} (${subject})`,
        "success",
      ),
    );
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Wipe locally-cached TanStack Query entries. Active panels re-fetch
        automatically; nothing on the server is touched.
      </Typography>

      <SettingsGroup
        title="Cache groups"
        description="Clear one cache at a time. The access-token query is never included."
      >
        {queryCacheGroups.map((group) => (
          <SettingsRow
            key={group.id}
            title={group.label}
            description={group.description}
            control={
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<DeleteSweepIcon />}
                onClick={() => performWipe([group.id])}
              >
                Wipe
              </Button>
            }
          />
        ))}
      </SettingsGroup>

      <SettingsGroup
        title="Bulk actions"
        description="These clear several cache groups at once."
      >
        <SettingsRow
          title="Wipe everything"
          description="Clear every cache group above. The access-token query is left intact on purpose — wiping it would sign you out."
          control={
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => performWipe([WIPE_ALL_SENTINEL])}
            >
              Wipe everything
            </Button>
          }
        />

        <SettingsRow
          title="Wipe everything except user"
          description="Clears every cache group above except the current user, so other tabs and panels can keep rendering without a re-login."
          control={
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<DeleteSweepIcon />}
              onClick={() => performWipe([WIPE_ALL_EXCEPT_USERS_SENTINEL])}
            >
              Wipe except user
            </Button>
          }
        />
      </SettingsGroup>
    </Stack>
  );
};
