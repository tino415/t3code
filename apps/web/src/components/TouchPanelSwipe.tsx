import { useRouter, type AnyRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../rightPanelLayout";
import { selectThreadRightPanelState, useRightPanelStore } from "../rightPanelStore";
import { resolveThreadRouteRef } from "../threadRoutes";
import { dispatchPreviewAction } from "./preview/previewActionBus";
import {
  lockTouchAxis,
  resolvePanelSwipe,
  TOUCH_PANEL_SWIPE_DISTANCE,
  type PanelSwipeState,
  type TouchAxis,
} from "./touchPanelSwipe";
import { useSidebar } from "./ui/sidebar";

const OTHER_OPEN_DIALOG_SELECTOR =
  '[role="dialog"][data-open]:not([data-mobile="true"]):not([data-right-panel-sheet]), [role="alertdialog"][data-open]';

type TouchGesture = {
  readonly startX: number;
  readonly startY: number;
  readonly path: readonly EventTarget[];
  axis: TouchAxis | "done";
};

function readRouteThreadRef(router: AnyRouter) {
  return resolveThreadRouteRef(router.state.matches.at(-1)?.params ?? {});
}

function readRightPanel(router: AnyRouter) {
  const ref = readRouteThreadRef(router);
  const sheetLayout = window.matchMedia(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY).matches;
  if (!ref || !sheetLayout) return { available: false, open: false };
  const state = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, ref);
  const available = state.maximized !== true && state.surfaces.length > 0;
  return { available, open: available && state.isOpen };
}

/** One finger swiping sideways opens or closes the thread list and the right panel sheets. */
export function TouchPanelSwipe() {
  const router = useRouter();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- document touch listeners drive the panel sheets
  useEffect(() => {
    let gesture: TouchGesture | null = null;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      gesture =
        event.touches.length !== 1 || !touch || document.querySelector(OTHER_OPEN_DIALOG_SELECTOR)
          ? null
          : {
              startX: touch.clientX,
              startY: touch.clientY,
              path: event.composedPath(),
              axis: "pending",
            };
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!gesture || gesture.axis === "ignored" || gesture.axis === "done" || !touch) return;
      if (event.touches.length !== 1) {
        gesture.axis = "ignored";
        return;
      }
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (gesture.axis === "pending") gesture.axis = lockTouchAxis(gesture.path, deltaX, deltaY);
      if (gesture.axis !== "horizontal" || Math.abs(deltaX) < TOUCH_PANEL_SWIPE_DISTANCE) return;

      const rightPanel = readRightPanel(router);
      const state: PanelSwipeState = {
        threadsAvailable: isMobile,
        threadsOpen: isMobile && openMobile,
        rightPanelAvailable: rightPanel.available,
        rightPanelOpen: rightPanel.open,
      };
      const action = resolvePanelSwipe(deltaX, state);
      if (action === null) return;
      gesture.axis = "done";
      if (action === "openThreads") setOpenMobile(true);
      else if (action === "closeThreads") setOpenMobile(false);
      else dispatchPreviewAction("toggle-right-panel");
    };

    const reset = () => {
      gesture = null;
    };

    const options = { capture: true, passive: true } as const;
    document.addEventListener("touchstart", onTouchStart, options);
    document.addEventListener("touchmove", onTouchMove, options);
    document.addEventListener("touchend", reset, options);
    document.addEventListener("touchcancel", reset, options);
    return () => {
      document.removeEventListener("touchstart", onTouchStart, options);
      document.removeEventListener("touchmove", onTouchMove, options);
      document.removeEventListener("touchend", reset, options);
      document.removeEventListener("touchcancel", reset, options);
    };
  }, [isMobile, openMobile, router, setOpenMobile]);

  return null;
}
