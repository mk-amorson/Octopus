"use client";

// Client wrapper around <AppShell> that owns the selection provider.
// Layout (server) hands in the full node list, registry descriptions
// and graph links so every client descendant — the graph, the
// sidebar info panel, a future right-click menu — can read them via
// useSelection() without prop-drilling.

import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import {
  SelectionProvider,
  type PublicDef,
} from "./SelectionContext";
import type { PublicNode } from "@/lib/nodes/serialize";
import type { GraphLink } from "@/lib/graph/visual";

type Props = {
  nodes: PublicNode[];
  defs: Record<string, PublicDef>;
  links: GraphLink[];
  children: ReactNode;
};

export function AppFrame({ nodes, defs, links, children }: Props) {
  return (
    <SelectionProvider nodes={nodes} defs={defs} links={links}>
      <AppShell>{children}</AppShell>
    </SelectionProvider>
  );
}
