// Shared types between the server layout (which builds the sidebar
// tree) and the client AppShell (which renders it). Separate file so
// the "use client" AppShell can import types without pulling the
// whole server-only store module into the browser bundle.

export type SidebarNode = {
  id: string;
  name: string;
  typeName: string;
  enabled: boolean;
  running: boolean;
};

export type SidebarCategory = {
  category: string;
  /** Node types available in this category — used by the "Add" menu. */
  types: { id: string; name: string }[];
  /** User-created instances currently sitting under this category. */
  nodes: SidebarNode[];
};
