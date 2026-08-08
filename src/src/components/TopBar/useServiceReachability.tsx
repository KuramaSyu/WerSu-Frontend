import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getStatusApi, type StatusResponse } from "../../api/StatusApi";
import { unreachableServiceLabels } from "./serviceReachabilityModel";

/**
 * Reachability probe for `/api/status`. Drives the notifications
 * red dot and a one-shot modal that opens on first outage.
 *
 * One-shot fetch only: no polling, no refetch on focus/reconnect/
 * remount. The modal dedupes against the last shown outage shape
 * so re-renders with the same shape don't re-open it.
 *
 * When a new outage shape arrives we also invalidate the cached
 * entry so the next render is backed by a fresh fetch — otherwise
 * `staleTime: 30 min` would keep the user staring at a "service
 * down" modal long after the backend recovered. The dedupe via
 * `lastAnnouncedRef` keeps this to one extra fetch per new
 * outage shape.
 */
export function useServiceReachability(): ServiceReachability {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery<StatusResponse, Error>({
    queryKey: ["service-status"],
    queryFn: () => getStatusApi().getStatus(),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: false,
    refetchInterval: false,
    staleTime: 60 * 30 * 1000, // 30 min
    gcTime: Infinity,
  });

  const data = query.data;
  const servicesReachable =
    query.status === "success" &&
    !query.isLoading &&
    (data?.overall_ok ?? false);
  // Query failure = "everything down" for both copy and dedupe.
  const queryFailed = query.status === "error";
  // `unreachableServiceLabels(...)` returns a brand-new array on
  // every call. Memoize it on the status payload so the reference
  // stays stable across renders; without this, anything that lists
  // the array in a `useEffect` dep array would re-run on every
  // render -> setState -> re-render -> infinite update loop. (The
  // original `useEffect` below is what crashed with "Maximum
  // update depth exceeded" when the LeftRail started calling this
  // hook on every layout render.)
  const unreachableServices = useMemo(
    () => unreachableServiceLabels(data),
    [data],
  );
  // `effectiveUnreachable` is also a fresh array unless memoized.
  const effectiveUnreachable = useMemo(() => {
    return queryFailed && unreachableServices.length === 0
      ? ["Backend"]
      : unreachableServices;
  }, [queryFailed, unreachableServices]);

  // Ref because we never render from it; just dedupe by outage shape.
  const lastAnnouncedRef = useRef<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (servicesReachable && !queryFailed) {
      // Reset tracker on recovery so the next outage pops fresh.
      lastAnnouncedRef.current = [];
      setDialogOpen(false);
      return;
    }
    if (query.status === "pending") {
      return;
    }
    if (sameSet(effectiveUnreachable, lastAnnouncedRef.current)) {
      return;
    }
    lastAnnouncedRef.current = effectiveUnreachable;
    // Force a fresh fetch so the modal copy isn't held hostage by
    // a stale entry — `staleTime: 30 min` would otherwise leave
    // the user looking at a "service down" view long after the
    // backend recovered. The dedupe above ensures we only
    // invalidate once per new outage shape.
    void queryClient.invalidateQueries({ queryKey: ["service-status"] });
    setDialogOpen(true);
  }, [
    query.status,
    servicesReachable,
    queryFailed,
    effectiveUnreachable,
    queryClient,
  ]);

  return {
    status: servicesReachable
      ? "ok"
      : query.status === "pending"
        ? "loading"
        : query.status === "error"
          ? "error"
          : "degraded",
    servicesReachable,
    unreachableServices,
    dialogOpen,
    dismissDialog: () => setDialogOpen(false),
    goToSettings: () => {
      setDialogOpen(false);
      navigate("/settings?cat=administration");
    },
  };
}

/**
 * Returned by `useServiceReachability`. `servicesReachable` drives
 * the red dot; `unreachableServices` feeds the modal body;
 * `dialogOpen` / `dismissDialog` / `goToSettings` are the modal
 * control surface.
 */
export interface ServiceReachability {
  status: "loading" | "ok" | "degraded" | "error";
  servicesReachable: boolean;
  unreachableServices: string[];
  dialogOpen: boolean;
  dismissDialog: () => void;
  goToSettings: () => void;
}

/** Order-insensitive set equality on string arrays. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const item of b) {
    if (!sa.has(item)) return false;
  }
  return true;
}
