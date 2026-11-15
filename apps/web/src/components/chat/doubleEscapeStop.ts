import { useSyncExternalStore } from "react";

export const DOUBLE_ESCAPE_WINDOW_MS = 1000;

interface EscapePress {
  readonly armedAt: number | null;
  readonly stop: boolean;
}

export function pressEscape(armedAt: number | null, now: number): EscapePress {
  const armed = armedAt !== null && now - armedAt <= DOUBLE_ESCAPE_WINDOW_MS;
  return armed ? { armedAt: null, stop: true } : { armedAt: now, stop: false };
}

let armedAt: number | null = null;
let disarmTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setArmedAt(next: number | null) {
  armedAt = next;
  clearTimeout(disarmTimer);
  disarmTimer =
    next === null ? undefined : setTimeout(() => setArmedAt(null), DOUBLE_ESCAPE_WINDOW_MS);
  listeners.forEach((listener) => listener());
}

export function pressEscapeToStop(stop: () => void) {
  const press = pressEscape(armedAt, Date.now());
  setArmedAt(press.armedAt);
  if (press.stop) stop();
}

export function disarmEscapeToStop() {
  if (armedAt !== null) setArmedAt(null);
}

export function useEscapeToStopArmed() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => armedAt !== null,
    () => false,
  );
}
