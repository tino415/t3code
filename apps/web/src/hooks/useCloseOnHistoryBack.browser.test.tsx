import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  type AnyRouter,
  type RouterHistory,
  createRouter,
  Outlet,
  RouterProvider,
  useRouter,
} from "@tanstack/react-router";
import { StrictMode, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AlertDialog, AlertDialogPopup } from "~/components/ui/alert-dialog";
import { Dialog, DialogPopup } from "~/components/ui/dialog";
import { act, render, type Screen } from "../../test/render";
import { useCloseOnHistoryBack } from "./useCloseOnHistoryBack";

function Probe(props: { readonly open: boolean; readonly onClose: () => void }) {
  useCloseOnHistoryBack(props.open, props.onClose);
  return null;
}

function historyOf(screen: Screen) {
  const history = screen.router?.history;
  if (!history) throw new Error("test router is missing");
  return history;
}

function entryIndex(screen: Screen) {
  return historyOf(screen).location.state.__TSR_index;
}

// Without the app's stylesheet the dialog's inert siblings cover the popup, so pointer clicks never land.
async function pressInDialog(name: string) {
  const button = page.getByRole("button", { name }).element();
  await act(() => (button as HTMLButtonElement).click());
}

describe("useCloseOnHistoryBack", () => {
  it("closes on back and keeps the location", async () => {
    const onClose = vi.fn();
    await using screen = await render(<Probe open={false} onClose={onClose} />, {
      router: "/thread?tab=diff",
    });
    await screen.rerender(<Probe open onClose={onClose} />);
    expect(entryIndex(screen)).toBe(1);

    await act(() => historyOf(screen).back());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(historyOf(screen).location.href).toBe("/thread?tab=diff");
    expect(entryIndex(screen)).toBe(0);
  });

  it("removes its entry when closed another way", async () => {
    const onClose = vi.fn();
    await using screen = await render(<Probe open={false} onClose={onClose} />, {
      router: "/thread",
    });
    await screen.rerender(<Probe open onClose={onClose} />);
    expect(entryIndex(screen)).toBe(1);

    await screen.rerender(<Probe open={false} onClose={onClose} />);
    await act(async () => {});

    expect(onClose).not.toHaveBeenCalled();
    expect(historyOf(screen).location.href).toBe("/thread");
    expect(entryIndex(screen)).toBe(0);
  });

  it("leaves history alone after a navigation elsewhere", async () => {
    const onClose = vi.fn();
    await using screen = await render(<Probe open={false} onClose={onClose} />, {
      router: "/thread",
    });
    await screen.rerender(<Probe open onClose={onClose} />);
    await act(() => historyOf(screen).push("/other"));
    await screen.rerender(<Probe open={false} onClose={onClose} />);
    await act(async () => {});

    expect(onClose).not.toHaveBeenCalled();
    expect(historyOf(screen).location.href).toBe("/other");
    expect(entryIndex(screen)).toBe(2);
  });

  it("pushes one entry under StrictMode", async () => {
    const onClose = vi.fn();
    await using screen = await render(
      <StrictMode>
        <Probe open onClose={onClose} />
      </StrictMode>,
      { router: "/thread" },
    );
    await act(async () => {});

    expect(entryIndex(screen)).toBe(1);

    await act(() => historyOf(screen).back());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(entryIndex(screen)).toBe(0);
  });

  it("gives each open overlay its own entry, so back closes only the top one", async () => {
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();
    const stack = (outer: boolean, inner: boolean) => (
      <>
        <Probe open={outer} onClose={onCloseOuter} />
        <Probe open={inner} onClose={onCloseInner} />
      </>
    );
    await using screen = await render(stack(false, false), { router: "/thread" });
    await screen.rerender(stack(true, false));
    await screen.rerender(stack(true, true));
    expect(entryIndex(screen)).toBe(2);

    await act(() => historyOf(screen).back());
    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onCloseOuter).not.toHaveBeenCalled();

    await screen.rerender(stack(true, false));
    await act(() => historyOf(screen).back());
    expect(onCloseOuter).toHaveBeenCalledTimes(1);
    expect(entryIndex(screen)).toBe(0);
  });

  it("removes every entry when stacked overlays close together", async () => {
    const onClose = vi.fn();
    const stack = (open: boolean) => (
      <>
        <Probe open={open} onClose={onClose} />
        <Probe open={open} onClose={onClose} />
      </>
    );
    await using screen = await render(stack(false), { router: "/thread" });
    await screen.rerender(stack(true));
    expect(entryIndex(screen)).toBe(2);

    await screen.rerender(stack(false));
    await act(async () => {});

    expect(onClose).not.toHaveBeenCalled();
    expect(entryIndex(screen)).toBe(0);
  });
});

describe("dialog primitives", () => {
  function DialogOverConfirm() {
    const [dialogOpen, setDialogOpen] = useState(true);
    const [confirmOpen, setConfirmOpen] = useState(false);
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup>
          <p>dialog body</p>
          <button type="button" onClick={() => setConfirmOpen(true)}>
            ask
          </button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogPopup>
              <p>confirm body</p>
            </AlertDialogPopup>
          </AlertDialog>
        </DialogPopup>
      </Dialog>
    );
  }

  it("back closes a confirm on top of a dialog first, then the dialog", async () => {
    await using screen = await render(<DialogOverConfirm />, { router: "/thread" });
    await expect.element(page.getByText("dialog body")).toBeInTheDocument();
    await pressInDialog("ask");
    await expect.element(page.getByText("confirm body")).toBeInTheDocument();
    expect(entryIndex(screen)).toBe(2);

    await act(() => historyOf(screen).back());
    await expect.element(page.getByText("confirm body")).not.toBeInTheDocument();
    await expect.element(page.getByText("dialog body")).toBeInTheDocument();

    await act(() => historyOf(screen).back());
    await expect.element(page.getByText("dialog body")).not.toBeInTheDocument();
    expect(historyOf(screen).location.href).toBe("/thread");
  });

  it("back closes an uncontrolled dialog", async () => {
    await using screen = await render(
      <Dialog defaultOpen>
        <DialogPopup>
          <p>uncontrolled body</p>
        </DialogPopup>
      </Dialog>,
      { router: "/thread" },
    );
    await expect.element(page.getByText("uncontrolled body")).toBeInTheDocument();
    expect(entryIndex(screen)).toBe(1);

    await act(() => historyOf(screen).back());

    await expect.element(page.getByText("uncontrolled body")).not.toBeInTheDocument();
    expect(historyOf(screen).location.href).toBe("/thread");
  });
});

describe("with the browser's own history", () => {
  const NEXT_ROUTE = "/next" as never;

  const countPopstates = () => {
    const onPopstate = () => (counter.count += 1);
    const counter = {
      count: 0,
      [Symbol.dispose]: () => window.removeEventListener("popstate", onPopstate),
    };
    window.addEventListener("popstate", onPopstate);
    return counter;
  };

  const popstate = () =>
    new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true }),
    );

  const tsrIndex = () => window.history.state.__TSR_index;

  let pageMounts = 0;

  function Page() {
    const router = useRouter<AnyRouter>();
    const [open, setOpen] = useState(false);
    useEffect(() => {
      pageMounts += 1;
    }, []);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogPopup>
            <p>dialog body</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void router.navigate({ to: NEXT_ROUTE });
              }}
            >
              go next
            </button>
          </DialogPopup>
        </Dialog>
      </>
    );
  }

  function openBrowserRouterAt(path: string) {
    window.history.replaceState(null, "", path);
    pageMounts = 0;
    const root = createRootRoute({ component: Outlet });
    const index = createRoute({ getParentRoute: () => root, path: "/", component: Page });
    const next = createRoute({
      getParentRoute: () => root,
      path: "/next",
      component: () => <p>next page</p>,
    });
    const router: AnyRouter = createRouter({
      routeTree: root.addChildren([index, next]),
      history: createBrowserHistory(),
      disableGlobalCatchBoundary: true,
    });
    return {
      router,
      [Symbol.dispose]: () => {
        router.history.destroy();
        window.history.replaceState(null, "", "/");
      },
    };
  }

  it("keeps the route mounted and the url unchanged, and back closes the dialog", async () => {
    using harness = openBrowserRouterAt("/");
    await using _screen = await render(<RouterProvider router={harness.router} />, {
      router: false,
    });
    await page.getByRole("button", { name: "open" }).click();
    await expect.element(page.getByText("dialog body")).toBeInTheDocument();
    expect(tsrIndex()).toBe(1);
    expect(window.location.pathname).toBe("/");

    const back = popstate();
    window.history.back();
    await back;

    await expect.element(page.getByText("dialog body")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(tsrIndex()).toBe(0);
    expect(pageMounts).toBe(1);
  });

  it("ends on the new route when a dialog closes and navigates in one step", async () => {
    using harness = openBrowserRouterAt("/");
    await using _screen = await render(<RouterProvider router={harness.router} />, {
      router: false,
    });
    await page.getByRole("button", { name: "open" }).click();
    await expect.element(page.getByText("dialog body")).toBeInTheDocument();

    await pressInDialog("go next");

    await expect.element(page.getByText("next page")).toBeInTheDocument();
    await act(async () => {});
    expect(window.location.pathname).toBe("/next");
    expect(tsrIndex()).toBe(2);
  });

  it("ends on the new route when the navigation lands while the entry is being removed", async () => {
    using harness = openBrowserRouterAt("/");
    const history: RouterHistory = harness.router.history;
    const go = history.go;
    history.go = (delta, options) => {
      go(delta, options);
      history.go = go;
      void harness.router.navigate({ to: NEXT_ROUTE });
    };
    await using _screen = await render(<RouterProvider router={harness.router} />, {
      router: false,
    });
    await page.getByRole("button", { name: "open" }).click();
    await expect.element(page.getByText("dialog body")).toBeInTheDocument();

    using traversals = countPopstates();
    await pressInDialog("Close");
    await expect.poll(() => traversals.count).toBe(3);

    await expect.element(page.getByText("next page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/next");
    expect(tsrIndex()).toBe(2);
  });
});
