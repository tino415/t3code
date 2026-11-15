import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  type AnyRouter,
  type HistoryLocation,
  type RouterHistory,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef } from "react";

import { selectThreadDiffPanelSelection, useDiffPanelStore } from "../diffPanelStore";
import {
  type RightPanelRequest,
  type RightPanelSearch,
  rightPanelRequestOfSearch,
  rightPanelSearchOfSurface,
  sameRightPanelSearch,
  validateRightPanelSearch,
} from "../rightPanelSearch";
import {
  selectActiveRightPanelSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../rightPanelStore";

const STATE_KEY = "rightPanel";
const PANEL_SEARCH_KEYS = ["panel", "tab", "line", "turn"] as const;

export interface PanelStamp {
  activeSurfaceId: string | null;
  isOpen: boolean;
}

export type PanelHistoryWrite = "push" | "replace" | "none";

export function planPanelHistoryWrite(input: {
  before: PanelStamp;
  after: PanelStamp;
  userAction: boolean;
  sheet: boolean;
}): PanelHistoryWrite {
  const { before, after } = input;
  if (before.activeSurfaceId === after.activeSurfaceId && before.isOpen === after.isOpen) {
    return "none";
  }
  if (!input.userAction) return "replace";
  // A phone sheet owns its open and close entry through useCloseOnHistoryBack.
  if (input.sheet && before.isOpen !== after.isOpen) return "replace";
  return "push";
}

function stampOf(location: HistoryLocation): PanelStamp | null {
  const stamp: unknown = Reflect.get(location.state, STATE_KEY);
  if (typeof stamp !== "object" || stamp === null) return null;
  const isOpen: unknown = Reflect.get(stamp, "isOpen");
  const activeSurfaceId: unknown = Reflect.get(stamp, "activeSurfaceId");
  if (typeof isOpen !== "boolean") return null;
  return { isOpen, activeSurfaceId: typeof activeSurfaceId === "string" ? activeSurfaceId : null };
}

function currentStamp(ref: ScopedThreadRef): PanelStamp {
  const thread = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, ref);
  return { activeSurfaceId: thread.activeSurfaceId, isOpen: thread.isOpen };
}

function currentSearch(ref: ScopedThreadRef): RightPanelSearch {
  const state = useRightPanelStore.getState();
  if (!selectThreadRightPanelState(state.byThreadKey, ref).isOpen) return {};
  const surface = selectActiveRightPanelSurface(state.byThreadKey, ref);
  const selection = selectThreadDiffPanelSelection(useDiffPanelStore.getState().byThreadKey, ref);
  return rightPanelSearchOfSurface(surface, selection.kind === "turn" ? selection.turnId : null);
}

function locationSearch(router: AnyRouter, location: HistoryLocation): RightPanelSearch {
  return validateRightPanelSearch(router.options.parseSearch(location.search));
}

function hrefWithPanel(router: AnyRouter, location: HistoryLocation, panel: RightPanelSearch) {
  const search: Record<string, unknown> = router.options.parseSearch(location.search);
  for (const key of PANEL_SEARCH_KEYS) delete search[key];
  return `${location.pathname}${router.options.stringifySearch({ ...search, ...panel })}${location.hash}`;
}

function openRequest(
  ref: ScopedThreadRef,
  projectId: string | null,
  request: RightPanelRequest,
  current: RightPanelSearch,
) {
  const store = useRightPanelStore.getState();
  switch (request.kind) {
    case "file":
      store.openFile(ref, request.relativePath, request.line);
      return;
    case "diff":
      if (request.turnId !== undefined) {
        const diffAlreadyActive = current.panel === "diff";
        useDiffPanelStore.getState().selectTurn(ref, request.turnId, undefined, !diffAlreadyActive);
      } else if (current.panel === "diff") return;
      store.open(ref, "diff");
      return;
    case "pull-request":
      if (projectId === null) return;
      store.openPullRequest(ref, {
        projectId,
        repository: request.repository,
        number: request.number,
        ...(request.detailTab === undefined ? {} : { detailTab: request.detailTab }),
      });
      return;
  }
}

function applyLocation(
  router: AnyRouter,
  ref: ScopedThreadRef,
  projectId: string | null,
  location: HistoryLocation,
  traversal: boolean,
) {
  const search = locationSearch(router, location);
  const current = currentSearch(ref);
  const stamp = stampOf(location);
  const store = useRightPanelStore.getState();
  const thread = selectThreadRightPanelState(store.byThreadKey, ref);
  if (stamp !== null) {
    if (!stamp.isOpen) {
      if (thread.isOpen) store.close(ref);
      return;
    }
    if (
      stamp.activeSurfaceId !== null &&
      thread.surfaces.some((s) => s.id === stamp.activeSurfaceId)
    ) {
      if (!thread.isOpen || thread.activeSurfaceId !== stamp.activeSurfaceId) {
        store.activateSurface(ref, stamp.activeSurfaceId);
      }
      return;
    }
    return;
  }
  const request = rightPanelRequestOfSearch(search);
  if (request !== null) {
    if (!sameRightPanelSearch(search, current)) openRequest(ref, projectId, request, current);
    return;
  }
  if (traversal && thread.isOpen) store.close(ref);
}

export function useRightPanelHistory(input: {
  threadRef: ScopedThreadRef;
  projectId: string | null;
  sheet: boolean;
  enabled: boolean;
}) {
  const router = useRouter({ warn: false }) as AnyRouter | undefined;
  const history: RouterHistory | undefined = router?.history;
  const { environmentId, threadId } = input.threadRef;
  const threadKey = scopedThreadKey(input.threadRef);
  const apply = useEffectEvent((location: HistoryLocation, traversal: boolean) => {
    if (router) applyLocation(router, input.threadRef, input.projectId, location, traversal);
  });
  const sheetOpen = useEffectEvent(() => input.sheet);
  const hasProject = input.projectId !== null;
  const applyingRef = useRef(false);
  const applyFromHistory = useEffectEvent((location: HistoryLocation, traversal: boolean) => {
    applyingRef.current = true;
    try {
      apply(location, traversal);
    } finally {
      applyingRef.current = false;
    }
  });
  const stampCurrentEntry = useEffectEvent(() => {
    if (!router || !history) return;
    const ref = scopeThreadRef(environmentId, threadId);
    const requested = locationSearch(router, history.location);
    const requestPending =
      requested.panel !== undefined && !sameRightPanelSearch(requested, currentSearch(ref));
    if (requestPending) return;
    history.replace(hrefWithPanel(router, history.location, currentSearch(ref)), {
      ...history.location.state,
      [STATE_KEY]: currentStamp(ref),
    });
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a link naming a pull request waits for the thread's project to hydrate
  useEffect(() => {
    if (!router || !history || !input.enabled || !hasProject) return;
    applyFromHistory(history.location, false);
    stampCurrentEntry();
  }, [router, history, input.enabled, hasProject]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mirrors the right panel store into browser history entries and back
  useEffect(() => {
    if (!router || !history || !input.enabled) return;
    const ref = scopeThreadRef(environmentId, threadId);
    const threadPathname = history.location.pathname;

    applyFromHistory(history.location, false);
    stampCurrentEntry();

    let last = currentStamp(ref);
    const unsubscribeStore = useRightPanelStore.subscribe((state, previous) => {
      if (applyingRef.current) {
        last = currentStamp(ref);
        return;
      }
      const after = currentStamp(ref);
      const userAction =
        state.userActionRevisionByThreadKey[threadKey] !==
        previous.userActionRevisionByThreadKey[threadKey];
      const write = planPanelHistoryWrite({ before: last, after, userAction, sheet: sheetOpen() });
      last = after;
      if (write === "none") return;
      const { location } = history;
      if (location.pathname !== threadPathname) return;
      const href = hrefWithPanel(router, location, currentSearch(ref));
      const nextState = { ...location.state, [STATE_KEY]: after };
      if (write === "push") history.push(href, nextState);
      else history.replace(href, nextState);
    });

    const unsubscribeHistory = history.subscribe(({ location, action }) => {
      if (location.pathname !== threadPathname) return;
      const traversal = action.type === "BACK" || action.type === "FORWARD" || action.type === "GO";
      if (traversal) applyFromHistory(location, true);
      else if (stampOf(location) === null) applyFromHistory(location, false);
    });

    return () => {
      unsubscribeStore();
      unsubscribeHistory();
    };
  }, [router, history, environmentId, threadId, threadKey, input.enabled]);
}
