// Shared source of truth for the sidebar's responsive width. The
// Tailwind class string below drives the actual DOM; the pixel
// numbers here let the 3D graph offset its camera-view by exactly
// the same amount so the scene centres in the visible area
// regardless of breakpoint.
//
// Two files read from here — AppShell (for the class on the <aside>)
// and GraphCanvas (for the offset px) — so the two can't drift.
// Bump a breakpoint in one place and both update together.

export const SIDEBAR_WIDTH = {
  md: 288, // Tailwind `w-72`  — 768+ px viewport
  lg: 320, // Tailwind `w-80`  — 1024+ px viewport
  xl: 384, // Tailwind `w-96`  — 1280+ px viewport
} as const;

// Mobile (< md) keeps the sidebar as an overlay drawer: it slides
// in from the left but doesn't push the main panel. The graph's
// camera offset stays at zero on that breakpoint for the same reason.
export const SIDEBAR_CLASS = "w-72 lg:w-80 xl:w-96";

/**
 * Pixel width currently occupied by the persistent sidebar — i.e.
 * how many CSS px the 3D canvas should compensate for when it
 * centres the scene on a selected node. Returns 0 on small
 * viewports (drawer mode), where the sidebar floats over the
 * canvas and doesn't need compensation.
 *
 * Callers are expected to re-invoke this on window resize; use
 * `onSidebarWidthChange` to subscribe.
 */
export function currentSidebarWidth(): number {
  if (typeof window === "undefined") return 0;
  if (window.matchMedia("(min-width: 1280px)").matches) return SIDEBAR_WIDTH.xl;
  if (window.matchMedia("(min-width: 1024px)").matches) return SIDEBAR_WIDTH.lg;
  if (window.matchMedia("(min-width: 768px)").matches) return SIDEBAR_WIDTH.md;
  return 0;
}

/** Call `handler` whenever crossing any of the breakpoints above
 *  changes the active sidebar width. Returns an unsubscribe fn. */
export function onSidebarWidthChange(handler: (px: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const queries = [
    window.matchMedia("(min-width: 768px)"),
    window.matchMedia("(min-width: 1024px)"),
    window.matchMedia("(min-width: 1280px)"),
  ];
  const listener = () => handler(currentSidebarWidth());
  for (const q of queries) q.addEventListener("change", listener);
  return () => {
    for (const q of queries) q.removeEventListener("change", listener);
  };
}
