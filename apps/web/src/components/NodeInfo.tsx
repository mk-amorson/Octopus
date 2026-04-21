"use client";

// Read-only summary of a selected node, dropped into the left
// sidebar between the brand and the logout button. Four sections:
//   - description (from the node definition)
//   - inputs      (def-declared signals this node accepts)
//   - outputs     (def-declared signals this node emits)
//   - connections (other instances it's linked to right now)
//
// No settings, no controls — settings for this hub type come back
// when real node types land next to it.

import { useSelection, type PublicDef } from "./SelectionContext";
import type { PublicNode } from "@/lib/nodes/serialize";

export function NodeInfo() {
  const { nodes, defs, links, selectedId } = useSelection();
  if (!selectedId) return null;
  const node = nodes.find((n) => n.id === selectedId);
  const def = node ? defs[node.type] : null;
  if (!node || !def) return null;

  const connected = links
    .filter((l) => l.source === node.id || l.target === node.id)
    .map((l) => (l.source === node.id ? l.target : l.source))
    .map((id) => nodes.find((n) => n.id === id)?.name ?? id);

  return (
    <div className="px-4 py-4 border-b border-white/10">
      <h2 className="font-pixel text-sm text-white/90 mb-2 break-words">{node.name}</h2>
      <p className="text-[11px] text-white/50 leading-relaxed mb-4">
        {def.description}
      </p>
      <Section title="inputs" items={def.inputs} />
      <Section title="outputs" items={def.outputs} />
      <Section title="connections" items={connected} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-3 first:mt-0">
      <h3 className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/30">—</p>
      ) : (
        <ul className="text-[11px] text-white/70 space-y-0.5">
          {items.map((i) => (
            <li key={i} className="break-words">
              · {i}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Re-export for type-checking consumers that need a hand with the
// shape. Keeps PublicNode importable alongside the runtime component.
export type { PublicNode };
