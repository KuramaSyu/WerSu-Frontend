import React, { useMemo } from "react";
import {
  Chip,
  Stack,
  TextField,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import CollapseToggleButton from "../../components/CollapseToggleButton";
import { M1, M2, M3 } from "../../statics";
import {
  SCHEDULE_OPTIONS,
  type Permission,
  type ShareFormValue,
  type Visibility,
} from "./shareFormModel";

export interface ShareFormSectionProps {
  value: ShareFormValue;
  onChange: (next: ShareFormValue) => void;
}

/**
 * Style for the in-form sub-section labels ("Visibility", "Access",
 * "Expires at", "Description").
 *
 * They sit *under* the dialog's main "Create share" / "Edit share"
 * heading — so we render them as a small, uppercase, letter-spaced
 * caption. That gives a clear top-to-bottom hierarchy:
 *
 *   1. "Create share" / "Edit share"  — h4 (in `ShareDialog.tsx`)
 *   2. "Visibility" / "Access" / …   — `SECTION_LABEL` (subtitle2 caps)
 *   3. the actual control
 */
const SECTION_LABEL_SX = {
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
  color: "text.secondary",
} as const;

/**
 * Format an ISO timestamp as the `value` for `<input type="datetime-local">`.
 *
 * The native datetime-local input expects "wall clock" components in the
 * viewer's local timezone (`YYYY-MM-DDTHH:mm`), NOT a UTC ISO string.
 * Passing an ISO directly would silently shift the displayed time by the
 * local TZ offset.
 *
 * Returns `""` when the input is missing or unparseable so the field
 * shows up empty rather than prefilled with garbage.
 */
const isoToDatetimeLocal = (iso: string | undefined | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

/**
 * Convert the `value` of a `<input type="datetime-local">` back into an
 * ISO timestamp. Treats the input as local-time wall clock (matching the
 * format produced by `isoToDatetimeLocal`).
 */
const datetimeLocalToIso = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

/**
 * The controlled share-creation / share-edit form. Renders visibility,
 * access, expires-after and description controls.
 *
 * The parent owns the value and is notified of changes via `onChange`,
 * so the same component is reused for both create and edit modes.
 */
export const ShareFormSection: React.FC<ShareFormSectionProps> = ({
  value,
  onChange,
}) => {
  const update = <K extends keyof ShareFormValue>(
    key: K,
    next: ShareFormValue[K],
  ) => onChange({ ...value, [key]: next });

  /**
   * `min` for the datetime input — the browser uses it both to disable
   * past dates in the picker UI and to flag out-of-range form submits.
   * We compute it lazily so it tracks the current wall-clock time.
   */
  const minDatetimeLocal = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, [value.onlineUntil]); // recompute whenever the user picks a new value

  /**
   * Resolve `onlineUntil` (ISO) into "seconds from now". Used both to
   * highlight the matching quick-pick chip and to drive the "active
   * chip" math. A negative value means the share is already expired;
   * we still compute it so the UI can show that to the user.
   */
  const secondsFromNow = useMemo(() => {
    const ts = Date.parse(value.onlineUntil);
    if (Number.isNaN(ts)) return null;
    return Math.round((ts - Date.now()) / 1000);
  }, [value.onlineUntil]);

  /**
   * Pick the chip whose bucket is the best fit for the current datetime.
   *
   * Match logic: bucket B is "active" if the remaining seconds fall
   * inside [B/2, 2*B). That window is wide enough that picking a chip
   * re-highlights it, even after a minute has passed, but narrow
   * enough that two adjacent chips (1H vs 1D) don't both light up.
   */
  const activeChipValue = useMemo(() => {
    if (secondsFromNow === null) return null;
    for (const item of SCHEDULE_OPTIONS) {
      const lo = item.value / 2;
      const hi = item.value * 2;
      if (secondsFromNow >= lo && secondsFromNow < hi) return item.value;
    }
    return null;
  }, [secondsFromNow]);

  const handleChipClick = (seconds: number) => {
    update("onlineUntil", new Date(Date.now() + seconds * 1000).toISOString());
  };

  return (
    <Stack direction="column" spacing={M3}>
      {/* --- Visibility --- */}
      <Stack direction="column" spacing={0.75}>
        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>
          Visibility
        </Typography>
        <ToggleButtonGroup
          aria-label="sharing options"
          value={value.visibility}
          exclusive
          onChange={(_, v: Visibility | null) => v && update("visibility", v)}
          size="small"
        >
          <Tooltip title="Everyone can find and see it">
            <CollapseToggleButton
              value="public"
              sx={{ gap: 0.5 }}
              selected={value.visibility === "public"}
              whenSelected={
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "nowrap", pl: 0.5 }}
                >
                  Public
                </Typography>
              }
            >
              <PublicIcon fontSize="small" />
            </CollapseToggleButton>
          </Tooltip>

          <Tooltip title="Only people with the link can access it">
            <CollapseToggleButton
              value="link"
              sx={{ gap: 0.5 }}
              selected={value.visibility === "link"}
              whenSelected={
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "nowrap", pl: 0.5 }}
                >
                  Link
                </Typography>
              }
            >
              <InsertLinkIcon fontSize="small" />
            </CollapseToggleButton>
          </Tooltip>

          <Tooltip title="Share it with specific users">
            <CollapseToggleButton
              value="user"
              sx={{ gap: M2 }}
              selected={value.visibility === "user"}
              whenSelected={
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "nowrap", pl: 0.5 }}
                >
                  User
                </Typography>
              }
            >
              <PersonAddIcon fontSize="small" />
            </CollapseToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Stack>

      {/* --- Access --- */}
      <Stack direction="column" spacing={0.75}>
        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>
          Access
        </Typography>
        <ToggleButtonGroup
          aria-label="access options"
          value={value.permission}
          exclusive
          onChange={(_, v: Permission | null) => v && update("permission", v)}
          size="small"
        >
          <Tooltip title="Recipients can view but not modify">
            <CollapseToggleButton
              value="read"
              sx={{ gap: 0.5 }}
              selected={value.permission === "read"}
              whenSelected={
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "nowrap", pl: 0.5 }}
                >
                  Only Read
                </Typography>
              }
            >
              <VisibilityIcon fontSize="small" />
            </CollapseToggleButton>
          </Tooltip>

          <Tooltip title="Recipients can view and modify">
            <CollapseToggleButton
              value="write"
              sx={{ gap: 0.5 }}
              selected={value.permission === "write"}
              whenSelected={
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "nowrap", pl: 0.5 }}
                >
                  Can Edit
                </Typography>
              }
            >
              <EditIcon fontSize="small" />
            </CollapseToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Stack>

      {/* --- Expires at --- */}
      <Stack direction="column" spacing={0.75}>
        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>
          Expires at
        </Typography>
        <TextField
          type="datetime-local"
          value={isoToDatetimeLocal(value.onlineUntil)}
          onChange={(e) => {
            const iso = datetimeLocalToIso(e.target.value);
            // Guard against transient empty / invalid strings so we don't
            // clobber `onlineUntil` with garbage mid-edit. The parent
            // validator (in ShareDialog) still rejects a past timestamp.
            if (iso !== null) update("onlineUntil", iso);
          }}
          slotProps={{
            // MUI v5/v6 doesn't accept native `<input>` attrs (like
            // `min`) directly on `<TextField>`; pass them via
            // `slotProps.htmlInput` so the native datetime picker can
            // disable past dates.
            htmlInput: { min: minDatetimeLocal },
          }}
          variant="outlined"
          size="small"
        />

        {/* Quick-pick chips — clicking one resolves "now + N" and writes
            the resulting absolute timestamp into the form. */}
        <Stack
          direction="row"
          spacing={M1}
          sx={{ flexWrap: "wrap", rowGap: M1 }}
        >
          {SCHEDULE_OPTIONS.map((item) => (
            <Chip
              key={item.value}
              label={item.whenSelected}
              size="small"
              clickable
              color={activeChipValue === item.value ? "primary" : "default"}
              variant={activeChipValue === item.value ? "filled" : "outlined"}
              onClick={() => handleChipClick(item.value)}
            />
          ))}
        </Stack>
      </Stack>

      {/* --- Description --- */}
      <Stack direction="column" spacing={0.75}>
        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>
          Description
        </Typography>
        <TextField
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
          variant="outlined"
          size="small"
          multiline
          minRows={2}
        />
      </Stack>
    </Stack>
  );
};

export default ShareFormSection;
