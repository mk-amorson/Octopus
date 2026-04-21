// /nodes/new — catalogue of available node types. Optionally filtered
// by ?category=<name> or pre-selected with ?type=<id>. Clicking a
// card POSTs to /api/nodes to create an instance, then redirects to
// /nodes/<newId>.

import { CatalogGrid } from "@/components/CatalogGrid";
import { getRegistry } from "@/lib/nodes/registry";

export const dynamic = "force-dynamic";

export default function NewNodePage({
  searchParams,
}: {
  searchParams: { category?: string; type?: string };
}) {
  const all = getRegistry().map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    description: d.description,
    kind: d.kind,
  }));
  const filtered = searchParams.category
    ? all.filter((d) => d.category === searchParams.category)
    : all;

  return (
    <div className="h-full p-8 overflow-auto">
      <div className="max-w-4xl">
        <h1 className="font-pixel text-xl text-white/90 mb-1">
          add a node
        </h1>
        <p className="text-white/50 text-xs mb-6">
          {searchParams.category
            ? `category: ${searchParams.category}`
            : "pick a node type — each one is a single-purpose building block you'll configure on the next screen."}
        </p>
        <CatalogGrid nodes={filtered} preselect={searchParams.type} />
      </div>
    </div>
  );
}
