// / — the authenticated landing. A 3D force-directed graph of every
// node in this install, rendered full-bleed in the content area.
// Empty installs still see the central hub plus an overlay CTA
// nudging them to add their first node.

import Link from "next/link";
import { NodeGraphLoader } from "@/components/NodeGraphLoader";
import { list } from "@/lib/nodes/store";
import { manager } from "@/lib/nodes/manager";
import { getRegistry } from "@/lib/nodes/registry";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const registry = getRegistry();
  const instances = list();

  const nodes: GraphNode[] = [
    { id: "__hub__", label: "octopus", sublabel: "platform", role: "hub" },
    ...instances.map((inst) => {
      const def = registry.find((d) => d.id === inst.type);
      return {
        id: inst.id,
        label: inst.name,
        sublabel: def?.name,
        role: "instance" as const,
        kind: def?.kind,
        category: def?.category,
        running: manager.isRunning(inst.id),
        enabled: inst.enabled,
      };
    }),
  ];
  const links: GraphLink[] = instances.map((inst) => ({
    source: "__hub__",
    target: inst.id,
  }));

  return (
    <div className="relative h-full w-full">
      <NodeGraphLoader nodes={nodes} links={links} />
      {instances.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
          <div className="pointer-events-auto max-w-sm text-center space-y-3 bg-black/60 border border-white/10 rounded p-5 backdrop-blur-sm">
            <h1 className="font-pixel text-lg text-white/90">start with one node</h1>
            <p className="text-white/60 text-xs leading-relaxed">
              Each node you add orbits the hub. First try: Telegram —
              paste a bot token and watch live traces as messages
              arrive.
            </p>
            <Link
              href="/nodes/new"
              className="inline-block font-pixel text-sm text-white/90 hover:text-white border border-white/30 hover:border-white/60 px-4 py-2 transition-colors"
            >
              + add a node
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
