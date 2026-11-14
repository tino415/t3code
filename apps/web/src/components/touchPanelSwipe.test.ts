import { describe, expect, it } from "vite-plus/test";

import { lockTouchAxis, resolvePanelSwipe, type PanelSwipeState } from "./touchPanelSwipe";

const closed: PanelSwipeState = {
  threadsAvailable: true,
  threadsOpen: false,
  rightPanelAvailable: true,
  rightPanelOpen: false,
};

describe("lockTouchAxis", () => {
  it.each([
    ["too short to tell", 3, 2, "pending"],
    ["mostly horizontal", 20, 6, "horizontal"],
    ["mostly vertical stays a scroll", 6, 20, "ignored"],
    ["diagonal tie stays a scroll", 12, 12, "ignored"],
  ] as const)("%s", (_name, deltaX, deltaY, expected) => {
    expect(lockTouchAxis([], deltaX, deltaY)).toBe(expected);
  });
});

describe("resolvePanelSwipe", () => {
  it.each([
    ["short of the distance", 79, closed, null],
    ["left to right opens the thread list", 80, closed, "openThreads"],
    ["right to left opens the right panel", -80, closed, "toggleRightPanel"],
    ["no thread list on wide layouts", 120, { ...closed, threadsAvailable: false }, null],
    ["no right panel without a thread", -120, { ...closed, rightPanelAvailable: false }, null],
    ["right to left closes the thread list", -90, { ...closed, threadsOpen: true }, "closeThreads"],
    ["left to right keeps the thread list", 90, { ...closed, threadsOpen: true }, null],
    [
      "left to right closes the right panel",
      90,
      { ...closed, rightPanelOpen: true },
      "toggleRightPanel",
    ],
    ["right to left keeps the right panel", -90, { ...closed, rightPanelOpen: true }, null],
  ] as const)("%s", (_name, deltaX, state, expected) => {
    expect(resolvePanelSwipe(deltaX, state)).toBe(expected);
  });
});
