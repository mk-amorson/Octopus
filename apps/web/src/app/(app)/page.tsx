// / — authenticated dashboard. Middleware gates it behind a valid
// session cookie, so everything below assumes the visitor is logged
// in. Intentionally empty content area for now — the AppShell draws
// the sidebar / burger / logout, and real features will grow into
// the <main> slot below as they arrive.

import { AppShell } from "@/components/AppShell";

// Mark fully dynamic so Next never bakes this route into the Full
// Route Cache with a year-long `s-maxage` header. Middleware still
// runs for static routes, but the response body can leak to the next
// visitor through any intermediate cache. Belt and suspenders.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell>
      {/* Intentionally empty — real dashboard widgets land here. */}
      <div className="h-full" />
    </AppShell>
  );
}
