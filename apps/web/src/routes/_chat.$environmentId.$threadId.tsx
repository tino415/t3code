import { createFileRoute } from "@tanstack/react-router";

import { validateRightPanelSearch } from "../rightPanelSearch";

// The _chat layout owns ChatView so draft promotion keeps it mounted.
export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  validateSearch: (raw: Record<string, unknown>) => {
    const { panel: _panel, tab: _tab, line: _line, turn: _turn, ...rest } = raw;
    return { ...rest, ...validateRightPanelSearch(raw) };
  },
  component: () => null,
});
