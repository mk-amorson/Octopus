// Every route under the `(app)` group gets the same shell. This
// layout is a server component so it can read the node store and
// registry once per request, then hand the already-shaped data to
// the client-side <AppFrame> that manages selection state and
// renders the sidebar + main canvas.

import { AppFrame } from "@/components/AppFrame";
import { list } from "@/lib/nodes/store";
import { getRegistry } from "@/lib/nodes/registry";
import { toPublicView } from "@/lib/nodes/serialize";
import type { PublicDef } from "@/components/SelectionContext";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const nodes = list().map(toPublicView);
  const defs: Record<string, PublicDef> = Object.fromEntries(
    getRegistry().map((d) => [
      d.id,
      {
        id: d.id,
        name: d.name,
        category: d.category,
        description: d.description,
        graphRole: d.graphRole ?? "instance",
        inputs: d.inputs ?? [],
        outputs: d.outputs ?? [],
      },
    ]),
  );
  // Links list is empty until connection support lands. The info
  // panel still reads it from context so adding them later is a
  // one-line change in the page (and nowhere else).
  return (
    <AppFrame nodes={nodes} defs={defs} links={[]}>
      {children}
    </AppFrame>
  );
}
