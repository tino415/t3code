import { describe, expect, it } from "vite-plus/test";

import {
  composerFullScreenEditorHeight,
  composerFullScreenMaxHeight,
} from "./composerFullScreenLayout";

describe("composer full screen layout", () => {
  it("stops at the header with the keyboard closed", () => {
    expect(
      composerFullScreenMaxHeight({
        screenHeight: 800,
        navigationHeaderHeight: 100,
        keyboardHeight: 0,
        composerBottomInset: 34,
      }),
    ).toBe(692);
  });

  it("stops at the keyboard, which overlaps the composer's own bottom inset", () => {
    expect(
      composerFullScreenMaxHeight({
        screenHeight: 800,
        navigationHeaderHeight: 100,
        keyboardHeight: 336,
        composerBottomInset: 34,
      }),
    ).toBe(390);
  });

  it("never reports a negative height", () => {
    expect(
      composerFullScreenMaxHeight({
        screenHeight: 200,
        navigationHeaderHeight: 100,
        keyboardHeight: 336,
        composerBottomInset: 0,
      }),
    ).toBe(0);
  });

  it("leaves the editor what the surrounding chrome does not use", () => {
    expect(
      composerFullScreenEditorHeight({ maxHeight: 400, chromeHeight: 120, minimumHeight: 44 }),
    ).toBe(280);
  });

  it("keeps the editor usable when the chrome fills the space", () => {
    expect(
      composerFullScreenEditorHeight({ maxHeight: 100, chromeHeight: 120, minimumHeight: 44 }),
    ).toBe(44);
  });
});
