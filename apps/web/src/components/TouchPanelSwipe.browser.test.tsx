import { describe, expect, it } from "vite-plus/test";

import { render } from "../../test/render";
import { TouchPanelSwipe } from "./TouchPanelSwipe";
import { SidebarProvider, useSidebar } from "./ui/sidebar";

function ThreadListState() {
  const { isMobile, openMobile } = useSidebar();
  return <output data-testid="threads">{isMobile && openMobile ? "open" : "closed"}</output>;
}

function swipe(target: Element, ...xs: number[]) {
  const touchAt = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: 200 });
  const fire = (type: string, touches: Touch[]) =>
    target.dispatchEvent(
      new TouchEvent(type, { touches, changedTouches: touches, bubbles: true, composed: true }),
    );
  fire("touchstart", [touchAt(xs[0]!)]);
  for (const x of xs.slice(1)) fire("touchmove", [touchAt(x)]);
  fire("touchend", []);
}

describe("TouchPanelSwipe", () => {
  it("a left to right swipe opens the thread list and right to left closes it", async () => {
    await using screen = await render(
      <SidebarProvider>
        <TouchPanelSwipe />
        <ThreadListState />
      </SidebarProvider>,
    );
    const state = screen.container.querySelector('[data-testid="threads"]')!;

    swipe(screen.container, 100, 120, 140, 190);
    await expect.element(state).toHaveTextContent("open");

    swipe(screen.container, 190, 150, 100);
    await expect.element(state).toHaveTextContent("closed");
  });

  it("a swipe over a code block that can still scroll sideways keeps the thread list closed", async () => {
    await using screen = await render(
      <SidebarProvider>
        <TouchPanelSwipe />
        <ThreadListState />
        <pre style={{ width: 100, overflowX: "auto" }}>
          <div style={{ width: 500 }}>code</div>
        </pre>
      </SidebarProvider>,
    );
    swipe(screen.container.querySelector("pre")!, 100, 140, 200);
    await expect
      .element(screen.container.querySelector('[data-testid="threads"]')!)
      .toHaveTextContent("closed");
  });

  it("a swipe that stays short of 80px leaves the thread list closed", async () => {
    await using screen = await render(
      <SidebarProvider>
        <TouchPanelSwipe />
        <ThreadListState />
      </SidebarProvider>,
    );
    swipe(screen.container, 100, 130, 170);
    await expect
      .element(screen.container.querySelector('[data-testid="threads"]')!)
      .toHaveTextContent("closed");
  });
});
