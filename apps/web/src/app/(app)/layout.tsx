// Every route under the `(app)` group gets the same chrome: sidebar
// on desktop, burger + drawer on mobile. The sidebar itself is now
// session-only (brand + logout); node interaction lives entirely on
// the dashboard canvas.

import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
