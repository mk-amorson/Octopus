// Typed factory for the 3d-force-graph instance. One file owns the
// bridge to the library's types so no call-site needs casts.
//
// Why a factory: 3d-force-graph 1.76 exports its default as a
// non-generic constructor (`declare const ForceGraph3D: IForceGraph3D`
// with the generics bound to the library's own NodeObject / LinkObject
// defaults). TypeScript doesn't let callers pass `<GraphNode, GraphLink>`
// to such a construct at the call site. The only way to re-expose it
// as a generic-friendly factory is to re-type the constructor here,
// once, with a cast justified by the library's type-level limitation.
// The rest of the codebase imports `createGraph` and never sees a cast.

import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";
import type { GraphLink, GraphNode } from "./visual";

export type Graph = ForceGraph3DInstance<GraphNode, GraphLink>;

type GraphCtor = new (element: HTMLElement) => Graph;

// Bridge: the library types the default export as a construct-with-
// `NodeObject` signature; we construct it with our stricter shape.
// NodeObject is `object & { id?, x?, y?, z?, … }` and GraphNode adds
// only required fields to that base — the narrowing is safe at runtime.
const TypedForceGraph3D = ForceGraph3D as unknown as GraphCtor;

export function createGraph(element: HTMLElement): Graph {
  return new TypedForceGraph3D(element);
}
