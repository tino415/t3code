import { RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  rightPanelRequestOfSearch,
  rightPanelSearchOfSurface,
  validateRightPanelSearch,
} from "./rightPanelSearch";
import { pullRequestSurface } from "./rightPanelStore";

describe("right panel search", () => {
  it.each([
    [
      "pull request",
      rightPanelSearchOfSurface(
        pullRequestSurface({ projectId: "p", repository: "o/r", number: 12, detailTab: "code" }),
      ),
      { kind: "pull-request", repository: "o/r", number: 12, detailTab: "code" },
    ],
    [
      "file",
      rightPanelSearchOfSurface({
        id: "file:a/b.ts",
        kind: "file",
        relativePath: "a/b.ts",
        revealLine: 40,
        revealRequestId: 1,
      }),
      { kind: "file", relativePath: "a/b.ts", line: 40 },
    ],
    [
      "diff",
      rightPanelSearchOfSurface({ id: "diff", kind: "diff" }, RunId.make("turn-1")),
      { kind: "diff", turnId: "turn-1" },
    ],
  ])("round trips a %s", (_name, search, request) => {
    expect(rightPanelRequestOfSearch(validateRightPanelSearch({ ...search }))).toEqual(request);
  });

  it("gives local surfaces no URL", () => {
    expect(rightPanelSearchOfSurface({ id: "files", kind: "files" })).toEqual({});
    expect(rightPanelSearchOfSurface(null)).toEqual({});
  });

  it.each([
    [{ panel: "pr:o/r/zero" }],
    [{ panel: "pr:12" }],
    [{ panel: "file:" }],
    [{ panel: "terminal:1" }],
    [{ panel: 7 }],
    [{}],
  ])("ignores junk %j", (raw) => {
    expect(rightPanelRequestOfSearch(validateRightPanelSearch(raw))).toBeNull();
  });

  it("drops invalid companions", () => {
    expect(validateRightPanelSearch({ panel: "diff", tab: "nope", line: -3, turn: "" })).toEqual({
      panel: "diff",
    });
  });
});
