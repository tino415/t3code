import {
  type AnyRouter,
  type HistoryLocation,
  type RouterHistory,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useEffectEvent, useId } from "react";

const MARKER = "closeOnHistoryBack";

const pushedEntries: string[] = [];
const openEntries = new Set<string>();
let popScheduled = false;
let popInFlight = false;

const markerOf = (location: HistoryLocation): string | undefined => {
  const marker: unknown = Reflect.get(location.state, MARKER);
  return typeof marker === "string" ? marker : undefined;
};

const positionOf = (marker: string | undefined) =>
  marker === undefined ? -1 : pushedEntries.lastIndexOf(marker);

function forgetEntriesAboveCurrent(history: RouterHistory) {
  pushedEntries.length = positionOf(markerOf(history.location)) + 1;
}

function pushEntry(history: RouterHistory, entry: string) {
  forgetEntriesAboveCurrent(history);
  if (markerOf(history.location) === entry) return;
  const { href, state } = history.location;
  history.push(href, { ...state, [MARKER]: entry });
  pushedEntries.push(entry);
}

function closedEntriesOnTop() {
  let count = 0;
  while (
    count < pushedEntries.length &&
    !openEntries.has(pushedEntries[pushedEntries.length - 1 - count]!)
  ) {
    count += 1;
  }
  return count;
}

function popEntries(history: RouterHistory, count: number) {
  popInFlight = true;
  pushedEntries.length -= count;
  let navigatedTo: number | undefined;
  const unsubscribe = history.subscribe(({ location, action }) => {
    if (action.type === "PUSH" || action.type === "REPLACE") {
      navigatedTo = location.state.__TSR_index;
      return;
    }
    if (navigatedTo !== undefined && location.state.__TSR_index < navigatedTo) {
      history.forward();
      return;
    }
    unsubscribe();
    popInFlight = false;
    if (navigatedTo === undefined) schedulePopOfClosedEntries(history);
  });
  history.go(-count);
}

function popClosedEntries(history: RouterHistory) {
  popScheduled = false;
  if (popInFlight) return;
  forgetEntriesAboveCurrent(history);
  const count = closedEntriesOnTop();
  if (count > 0) popEntries(history, count);
}

function schedulePopOfClosedEntries(history: RouterHistory) {
  if (popScheduled) return;
  popScheduled = true;
  queueMicrotask(() => popClosedEntries(history));
}

export function useCloseOnHistoryBack(open: boolean, onClose: () => void): void {
  const router = useRouter({ warn: false }) as AnyRouter | undefined;
  const history: RouterHistory | undefined = router?.history;
  const entry = useId();
  const close = useEffectEvent(onClose);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps one router history entry per open overlay in step with it
  useEffect(() => {
    if (!open || !history) return;
    openEntries.add(entry);
    pushEntry(history, entry);
    const unsubscribe = history.subscribe(({ location, action }) => {
      const traversedBackwards =
        action.type === "BACK" || (action.type === "GO" && action.index < 0);
      if (traversedBackwards && positionOf(markerOf(location)) < positionOf(entry)) close();
    });
    return () => {
      unsubscribe();
      openEntries.delete(entry);
      schedulePopOfClosedEntries(history);
    };
  }, [open, history, entry]);
}
