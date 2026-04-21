// Every route under the `(app)` group gets the same chrome: sidebar
// on desktop, burger + drawer on mobile. The layout is a server
// component so it can read the node store directly (no extra HTTP
// round-trip) and hand the list down to the client AppShell.

import { AppShell } from "@/components/AppShell";
import { list } from "@/lib/nodes/store";
import { manager } from "@/lib/nodes/manager";
import { getRegistry } from "@/lib/nodes/registry";
import type { SidebarCategory, SidebarNode } from "@/lib/nodes/sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const registry = getRegistry();

  // Group registered node TYPES (not instances) by category; this is
  // the stable backbone of the sidebar — categories always render
  // even when the user has no matching instance yet.
  const categoryMap = new Map<string, SidebarCategory>();
  for (const def of registry) {
    const c =
      categoryMap.get(def.category) ??
      ({ category: def.category, types: [], nodes: [] } as SidebarCategory);
    c.types.push({ id: def.id, name: def.name });
    categoryMap.set(def.category, c);
  }

  // Then slot user-created instances under their type's category.
  for (const inst of list()) {
    const def = registry.find((d) => d.id === inst.type);
    if (!def) continue;
    const c = categoryMap.get(def.category);
    if (!c) continue;
    const node: SidebarNode = {
      id: inst.id,
      name: inst.name,
      typeName: def.name,
      enabled: inst.enabled,
      running: manager.isRunning(inst.id),
    };
    c.nodes.push(node);
  }

  const categories = Array.from(categoryMap.values());
  return <AppShell categories={categories}>{children}</AppShell>;
}
