"use client";

// The sidebar's middle slot: every category in the registry that
// has at least one instance, each rendered as a collapsible group
// of NodeTile rows. Matches the reference project shape — multiple
// categories can be open at once, but only one tile is expanded
// (that state comes from SelectionContext).

import { useState, useMemo } from "react";
import { useSelection } from "./SelectionContext";
import { NodeTile } from "./NodeTile";
import type { PublicNode } from "@/lib/nodes/serialize";

export function NodeTree() {
  const { nodes, defs, links, selectedId, select } = useSelection();

  const byCategory = useMemo(() => groupByCategory(nodes, defs), [nodes, defs]);
  // Default: every category open on first render so a visitor sees
  // the full tree without clicking.
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(byCategory.map((g) => g.category)),
  );

  function toggleCategory(cat: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function connectionsFor(nodeId: string): string[] {
    return links
      .filter((l) => l.source === nodeId || l.target === nodeId)
      .map((l) => (l.source === nodeId ? l.target : l.source))
      .map((id) => nodes.find((n) => n.id === id)?.name ?? id);
  }

  return (
    <div>
      {byCategory.map((group) => {
        const open = openCategories.has(group.category);
        return (
          <div key={group.category} className="border-b border-white/10">
            <button
              type="button"
              onClick={() => toggleCategory(group.category)}
              className="w-full flex items-center gap-2 pl-3 pr-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
              <Chevron open={open} />
              <span className="text-white/60 text-[11px] uppercase tracking-wider flex-1">
                {group.category}
              </span>
              <span className="text-white/30 text-[11px]">{group.nodes.length}</span>
            </button>
            <div
              className={`overflow-hidden transition-[max-height] duration-200 ${
                open ? "max-h-[2000px]" : "max-h-0"
              }`}
            >
              {group.nodes.map((n) => {
                const def = defs[n.type];
                if (!def) return null;
                return (
                  <NodeTile
                    key={n.id}
                    node={n}
                    def={def}
                    expanded={selectedId === n.id}
                    connections={connectionsFor(n.id)}
                    onToggle={() => select(selectedId === n.id ? null : n.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupByCategory(
  nodes: PublicNode[],
  defs: Record<string, { category?: string }>,
): Array<{ category: string; nodes: PublicNode[] }> {
  const map = new Map<string, PublicNode[]>();
  for (const n of nodes) {
    const cat = defs[n.type]?.category ?? "Other";
    const list = map.get(cat) ?? [];
    list.push(n);
    map.set(cat, list);
  }
  return Array.from(map.entries()).map(([category, ns]) => ({ category, nodes: ns }));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
