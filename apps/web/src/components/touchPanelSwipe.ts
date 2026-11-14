import { canScrollHorizontally, SWIPE_AXIS_LOCK_DISTANCE } from "./HistorySwipeNavigation";

export const TOUCH_PANEL_SWIPE_DISTANCE = 80;

export type PanelSwipeAction = "openThreads" | "closeThreads" | "toggleRightPanel";

export type PanelSwipeState = {
  readonly threadsAvailable: boolean;
  readonly threadsOpen: boolean;
  readonly rightPanelAvailable: boolean;
  readonly rightPanelOpen: boolean;
};

export type TouchAxis = "pending" | "horizontal" | "ignored";

export function lockTouchAxis(
  path: readonly EventTarget[],
  deltaX: number,
  deltaY: number,
): TouchAxis {
  if (Math.abs(deltaX) + Math.abs(deltaY) < SWIPE_AXIS_LOCK_DISTANCE) return "pending";
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return "ignored";
  return canScrollHorizontally(path, deltaX) ? "ignored" : "horizontal";
}

export function resolvePanelSwipe(deltaX: number, state: PanelSwipeState): PanelSwipeAction | null {
  if (Math.abs(deltaX) < TOUCH_PANEL_SWIPE_DISTANCE) return null;
  if (deltaX > 0) {
    if (state.rightPanelOpen) return "toggleRightPanel";
    if (state.threadsOpen) return null;
    return state.threadsAvailable ? "openThreads" : null;
  }
  if (state.threadsOpen) return "closeThreads";
  if (state.rightPanelOpen) return null;
  return state.rightPanelAvailable ? "toggleRightPanel" : null;
}
