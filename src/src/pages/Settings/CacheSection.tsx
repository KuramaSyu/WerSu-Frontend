import { Button, Divider, Stack, Typography } from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { queryClient } from "../../api/queryClient";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import {
  WIPE_ALL_SENTINEL,
  WIPE_ALL_EXCEPT_USERS_SENTINEL,
  queryCacheGroups,
  wipeQueryGroups,
} from "./queryCacheKeys";

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
    <Stack direction="column" spacing={2}>
      <Typography variant="body1">
        Wipe locally-cached TanStack Query entries. Active panels re-fetch
        automatically; nothing on the server is touched.
      </Typography>

      {queryCacheGroups.map((group) => (
        <Stack
          key={group.id}
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Stack sx={{ flex: 1 }}>
            <Typography variant="subtitle1">{group.label}</Typography>
            <Typography variant="body2" color="text.secondary">
              {group.description}
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<DeleteSweepIcon />}
            onClick={() => performWipe([group.id])}
          >
            Wipe
          </Button>
        </Stack>
      ))}

      <Divider />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack sx={{ flex: 1 }}>
          <Typography variant="subtitle1">Wipe everything</Typography>
          <Typography variant="body2" color="text.secondary">
            Clear every cache group above. The access-token query is left intact
            on purpose — wiping it would sign you out.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteSweepIcon />}
          onClick={() => performWipe([WIPE_ALL_SENTINEL])}
        >
          Wipe everything
        </Button>
      </Stack>

      <Divider />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack sx={{ flex: 1 }}>
          <Typography variant="subtitle1">
            {"Wipe everything except user"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Clears every cache group above except the current user, so other
            tabs and panels can keep rendering without a re-login.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          color="warning"
          startIcon={<DeleteSweepIcon />}
          onClick={() => performWipe([WIPE_ALL_EXCEPT_USERS_SENTINEL])}
        >
          Wipe except user
        </Button>
      </Stack>
    </Stack>
  );
};
