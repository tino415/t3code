import { expect, it } from "vite-plus/test";

import { DOUBLE_ESCAPE_WINDOW_MS, pressEscape } from "./doubleEscapeStop";

it("arms on the first Esc and stops on a second one inside the window", () => {
  const first = pressEscape(null, 5000);
  expect(first).toEqual({ armedAt: 5000, stop: false });
  expect(pressEscape(first.armedAt, 5000 + DOUBLE_ESCAPE_WINDOW_MS)).toEqual({
    armedAt: null,
    stop: true,
  });
});

it("arms again when the second Esc comes after the window, and resets after a stop", () => {
  const late = pressEscape(5000, 5000 + DOUBLE_ESCAPE_WINDOW_MS + 1);
  expect(late).toEqual({ armedAt: 5000 + DOUBLE_ESCAPE_WINDOW_MS + 1, stop: false });
  expect(pressEscape(null, 9000).stop).toBe(false);
});
