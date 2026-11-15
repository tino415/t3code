import { RunId } from "@t3tools/contracts";

import type { PullRequestDetailTab, RightPanelSurface } from "./rightPanelStore";

const PULL_REQUEST_TABS: readonly PullRequestDetailTab[] = ["summary", "guide", "timeline", "code"];

export interface RightPanelSearch {
  panel?: string;
  tab?: PullRequestDetailTab;
  line?: number;
  turn?: string;
}

export type RightPanelRequest =
  | { kind: "pull-request"; repository: string; number: number; detailTab?: PullRequestDetailTab }
  | { kind: "file"; relativePath: string; line?: number }
  | { kind: "diff"; turnId?: RunId };

export function validateRightPanelSearch(raw: Record<string, unknown>): RightPanelSearch {
  const panel = typeof raw.panel === "string" && raw.panel.length > 0 ? raw.panel : undefined;
  if (panel === undefined) return {};
  const tab = PULL_REQUEST_TABS.find((candidate) => candidate === raw.tab);
  const line = typeof raw.line === "number" && Number.isInteger(raw.line) && raw.line > 0;
  const turn = typeof raw.turn === "string" && raw.turn.length > 0 ? raw.turn : undefined;
  return {
    panel,
    ...(tab === undefined ? {} : { tab }),
    ...(line ? { line: raw.line as number } : {}),
    ...(turn === undefined ? {} : { turn }),
  };
}

export function rightPanelSearchOfSurface(
  surface: RightPanelSurface | null,
  turnId?: RunId | null,
): RightPanelSearch {
  switch (surface?.kind) {
    case "pull-request":
      return {
        panel: `pr:${surface.repository}/${surface.number}`,
        ...(surface.detailTab === undefined ? {} : { tab: surface.detailTab }),
      };
    case "file":
      if (surface.attachment !== undefined) return {};
      return {
        panel: `file:${surface.relativePath}`,
        ...(surface.revealLine === null ? {} : { line: surface.revealLine }),
      };
    case "diff":
      return { panel: "diff", ...(turnId ? { turn: turnId } : {}) };
    default:
      return {};
  }
}

export function rightPanelRequestOfSearch(search: RightPanelSearch): RightPanelRequest | null {
  const { panel } = search;
  if (panel === undefined) return null;
  if (panel === "diff") {
    return {
      kind: "diff",
      ...(search.turn === undefined ? {} : { turnId: RunId.make(search.turn) }),
    };
  }
  if (panel.startsWith("file:")) {
    const relativePath = panel.slice("file:".length);
    if (relativePath.length === 0) return null;
    return {
      kind: "file",
      relativePath,
      ...(search.line === undefined ? {} : { line: search.line }),
    };
  }
  if (panel.startsWith("pr:")) {
    const reference = panel.slice("pr:".length);
    const slash = reference.lastIndexOf("/");
    const number = Number(reference.slice(slash + 1));
    const repository = reference.slice(0, slash);
    if (slash < 1 || !Number.isInteger(number) || number < 1) return null;
    return {
      kind: "pull-request",
      repository,
      number,
      ...(search.tab === undefined ? {} : { detailTab: search.tab }),
    };
  }
  return null;
}

export const sameRightPanelSearch = (a: RightPanelSearch, b: RightPanelSearch) =>
  a.panel === b.panel && a.tab === b.tab && a.line === b.line && a.turn === b.turn;
