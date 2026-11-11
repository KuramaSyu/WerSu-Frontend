import {
  autoUpdate,
  computePosition,
  flip as flipMiddleware,
  offset as offsetMiddleware,
  shift as shiftMiddleware,
  type Placement,
  type VirtualElement,
} from "@floating-ui/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// Above MUI's app bar / drawers (1100–1250) and floating speed dials.
const Z_INDEX = 1500;
// Slide the menu between selection rects instead of jumping.
const MOVE_DURATION_MS = 180;

export interface BubbleMenuSurfaceProps {
  open: boolean;
  /**
   * Floating-ui reference. `null` while the menu is closed or the
   * selection has no measurable rect.
   */
  anchor: VirtualElement | null;
  placement?: Placement;
  offset?: number;
  /**
   * Allow floating-ui to move the menu to the opposite side when it
   * would overflow the viewport. Off by default for the text menu: a
   * double-click near the top of the viewport should keep the menu
   * above the selection and let `shift` nudge it on-screen.
   */
  flip?: boolean;
  children: ReactNode;
}

/**
 * Presentational floating surface shared by every bubble menu.
 *
 * It is deliberately independent of Tiptap's `BubbleMenu` plugin: the
 * plugin only re-runs its `shouldShow` hook on selection/document
 * transactions, so it kept the wrapper detached when editability or
 * `enabled` flipped (entering edit mode, toggling source/rich view)
 * with the selection unchanged. Here, visibility is plain React state:
 * the wrapper mounts on first open and stays mounted so the exit
 * transition can run; positioning is pure floating-ui.
 */
export const BubbleMenuSurface: React.FC<BubbleMenuSurfaceProps> = ({
  open,
  anchor,
  placement = "top",
  offset = 16,
  flip = false,
  children,
}) => {
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const snappedRef = useRef(false);
  // Mount on first open, then keep mounted so the menu can animate out.
  // Adjusting state during render (not in an effect) is the documented
  // "latch on a prop change" pattern and avoids an extra commit.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    const floating = floatingRef.current;
    if (!open || !anchor || !floating) return;

    // First appearance snaps to the selection instead of animating from
    // the previous cursor position; later selections slide. `autoUpdate`
    // covers the content laying out after this effect runs.
    if (!snappedRef.current) {
      snappedRef.current = true;
      floating.style.transition = "none";
      window.requestAnimationFrame(() => {
        floating.style.transition = `left ${MOVE_DURATION_MS}ms ease-out, top ${MOVE_DURATION_MS}ms ease-out`;
      });
    } else {
      floating.style.transition = `left ${MOVE_DURATION_MS}ms ease-out, top ${MOVE_DURATION_MS}ms ease-out`;
    }

    const update = () => {
      void computePosition(anchor, floating, {
        placement,
        strategy: "fixed",
        middleware: [
          offsetMiddleware(offset),
          ...(flip ? [flipMiddleware()] : []),
          shiftMiddleware({ padding: 8 }),
        ],
      }).then(({ x, y }) => {
        floating.style.left = `${x}px`;
        floating.style.top = `${y}px`;
      });
    };

    return autoUpdate(anchor, floating, update);
  }, [open, anchor, placement, offset, flip]);

  // Reset the snap so the next open does not animate from the old spot.
  useEffect(() => {
    if (open) return;
    snappedRef.current = false;
    if (floatingRef.current) {
      floatingRef.current.style.transition = "none";
    }
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={floatingRef}
      data-bubble-menu-surface=""
      // Keep the editor selection alive while a button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: Z_INDEX,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {children}
    </div>,
    document.body,
  );
};
