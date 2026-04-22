// Category palette + status palette. Single source of truth for every
// UI surface that paints a node — the 3D graph, the sidebar, the
// detail-page status pill, a future dashboard, anything.
//
// Keeping colours here (not spread across components) is what makes
// adding a new category (e.g. "Storage") a one-line change.

export type CategoryTheme = {
  color: string;
  /** CSS class applied to a fg text span; paired with `color` so the
   *  graph (Three.js) and the sidebar (Tailwind) can both render from
   *  the same source. */
  textClass: string;
};

export const HUB_COLOR = "#7c3aed"; // platform icosahedron in the centre
export const DEFAULT_COLOR = "#cccccc";

export const CATEGORY: Record<string, CategoryTheme> = {
  Triggers: { color: "#51ff97", textClass: "text-emerald-400" },
  Actions: { color: "#f472b6", textClass: "text-pink-400" },
  AI: { color: "#fb923c", textClass: "text-orange-400" },
};

export const STATUS = {
  running: { color: "#6ce26c", textClass: "text-emerald-400", label: "running" },
  enabled: { color: "#fbbf24", textClass: "text-amber-400", label: "enabled" },
  disabled: { color: "#555555", textClass: "text-white/30", label: "disabled" },
} as const;

export type StatusKey = keyof typeof STATUS;

export function colorFor(category: string | undefined): string {
  if (!category) return DEFAULT_COLOR;
  return CATEGORY[category]?.color ?? DEFAULT_COLOR;
}

export function statusFor(enabled: boolean, running: boolean): StatusKey {
  if (running) return "running";
  if (enabled) return "enabled";
  return "disabled";
}
