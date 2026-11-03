import React from "react";
import { ServiceFailureDialog } from "./ServiceFailureDialog";
import { useServiceReachability } from "./useServiceReachability";

/**
 * Always-mounted driver for the backend-reachability modal.
 *
 * Previously the probe + dialog lived in the top bar cluster and the
 * mobile bottom bar. Now that notifications (which carried the red
 * dot) moved into the user menu, the shell owns a single mount so the
 * modal keeps working on every route and viewport.
 */
export const ServiceFailureDialogHost: React.FC = () => {
  const reachability = useServiceReachability();

  return (
    <ServiceFailureDialog
      open={reachability.dialogOpen}
      unreachableServices={reachability.unreachableServices}
      onClose={reachability.dismissDialog}
      onIgnore={reachability.dismissDialog}
      onGoToSettings={reachability.goToSettings}
    />
  );
};

export default ServiceFailureDialogHost;
