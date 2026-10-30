// Single store-driven host for the shared directory modal (decision 1).
//
// Mounted once in App.tsx. Any surface (directory row, home card,
// main-page card, directory title menu) asks the store to open the
// modal and this host owns the mounted form instance, so all four
// call sites share one form state instead of each mounting its own.

import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { CreateDirectoryModal } from "../../pages/MainPage/CreateDirectory";

export const DirectoryDialogHost: React.FC = () => {
  const payload = useRightClickMenuStore((s) => s.directoryDialogPayload);
  const closeDirectoryDialog = useRightClickMenuStore(
    (s) => s.closeDirectoryDialog,
  );

  // Payload presence is the open flag; closing clears it so the next
  // request starts from a clean form.
  const open = payload !== null;

  return (
    <CreateDirectoryModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDirectoryDialog();
      }}
      mode={payload?.mode ?? "create"}
      directoryId={payload?.directoryId}
      parentId={payload?.parentId}
    />
  );
};

export default DirectoryDialogHost;
