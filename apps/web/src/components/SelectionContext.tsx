"use client";

// One context threads "which node is selected" from the graph (where
// the click happens) to the sidebar (where the info is rendered),
// and carries the server-fetched node list + registry descriptions
// so consumers don't each have to re-fetch them. Mounted by
// AppFrame; every client component under the (app) layout reads
// from here.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { PublicNode } from "@/lib/nodes/serialize";
import type { GraphLink } from "@/lib/graph/visual";

export type PublicDef = {
  id: string;
  name: string;
  category: string;
  description: string;
  graphRole: "hub" | "instance";
  inputs: string[];
  outputs: string[];
};

type Value = {
  nodes: PublicNode[];
  defs: Record<string, PublicDef>;
  links: GraphLink[];
  selectedId: string | null;
  select: (id: string | null) => void;
};

const Ctx = createContext<Value | null>(null);

export function SelectionProvider({
  nodes,
  defs,
  links,
  children,
}: {
  nodes: PublicNode[];
  defs: Record<string, PublicDef>;
  links: GraphLink[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{ nodes, defs, links, selectedId, select: setSelectedId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSelection(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelection must be used inside <SelectionProvider>");
  return v;
}
