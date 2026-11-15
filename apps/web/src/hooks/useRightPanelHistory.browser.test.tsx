import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../test/render";
import {
  selectActiveRightPanelSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../rightPanelStore";
import { planPanelHistoryWrite, useRightPanelHistory } from "./useRightPanelHistory";

const ref = scopeThreadRef("environment-one" as EnvironmentId, ThreadId.make("thread-one"));
const THREAD_PATH = "/environment-one/thread-one";

function Harness({
  sheet = false,
  projectId = "project-one",
}: {
  sheet?: boolean;
  projectId?: string | null;
}) {
  useRightPanelHistory({ threadRef: ref, projectId, sheet, enabled: true });
  return null;
}

const panelState = () =>
  selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, ref);
const activeId = () =>
  selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, ref)?.id;

function resetStore() {
  useRightPanelStore.setState({
    byThreadKey: {},
    userActionRevisionByThreadKey: {},
    closeRevisionByThreadKey: {},
  });
}

describe("right panel history", () => {
  it("steps Back through tab switches, then closes the panel", async () => {
    resetStore();
    await using screen = await render(<Harness />, { router: THREAD_PATH });
    const history = screen.router!.history;
    const store = useRightPanelStore.getState();

    store.openFile(ref, "a.ts");
    store.openFile(ref, "b.ts");
    store.activateSurface(ref, "file:a.ts");
    expect(history.location.search).toContain("panel=file");

    history.back();
    await vi.waitFor(() => expect(activeId()).toBe("file:b.ts"));
    history.back();
    await vi.waitFor(() => expect(activeId()).toBe("file:a.ts"));
    history.back();
    await vi.waitFor(() => expect(panelState().isOpen).toBe(false));
  });

  it("keeps a pull request link the thread cannot open yet", async () => {
    resetStore();
    await using screen = await render(<Harness projectId={null} />, {
      router: `${THREAD_PATH}?panel=pr%3Ao%2Fr%2F12`,
    });
    expect(screen.router!.history.location.search).toContain("panel=");
    expect(panelState().isOpen).toBe(false);
  });

  it("does not reopen a tab that was closed", async () => {
    resetStore();
    await using screen = await render(<Harness />, { router: THREAD_PATH });
    const history = screen.router!.history;
    const store = useRightPanelStore.getState();

    store.openFile(ref, "a.ts");
    store.openFile(ref, "b.ts");
    store.closeSurface(ref, "file:b.ts");
    history.back();
    await vi.waitFor(() => expect(history.location.search).toContain("b.ts"));
    expect(panelState().surfaces.map((surface) => surface.id)).toEqual(["file:a.ts"]);
  });

  it("opens the panel named by a link on load", async () => {
    resetStore();
    await using screen = await render(<Harness />, {
      router: `${THREAD_PATH}?panel=file%3Aa.ts&line=4`,
    });
    expect(screen.router).toBeDefined();
    expect(activeId()).toBe("file:a.ts");
    expect(panelState().isOpen).toBe(true);
  });
});

describe("planPanelHistoryWrite", () => {
  const closed = { activeSurfaceId: null, isOpen: false };
  const open = { activeSurfaceId: "diff", isOpen: true };

  it.each([
    ["a user tab switch", open, { ...open, activeSurfaceId: "files" }, true, false, "push"],
    ["a user open", closed, open, true, false, "push"],
    ["an agent open", closed, open, false, false, "replace"],
    ["a sheet open", closed, open, true, true, "replace"],
    ["a sheet tab switch", open, { ...open, activeSurfaceId: "files" }, true, true, "push"],
    ["no change", open, open, true, false, "none"],
  ] as const)("%s is a %s", (_name, before, after, userAction, sheet, expected) => {
    expect(planPanelHistoryWrite({ before, after, userAction, sheet })).toBe(expected);
  });
});
