// / — the authenticated landing. Middleware gates it behind a valid
// session cookie, so anything rendered here can assume the visitor
// is logged in. Intentionally bare today — a real dashboard will
// grow here; right now it's just the logo and a way to sign out so
// a logged-in user isn't trapped.

import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

// Mark the dashboard fully dynamic so Next.js doesn't bake it into the
// Full Route Cache with a year-long `s-maxage` header. That cache is
// harmless locally (middleware still runs in front of it) but would be
// a session-leak waiting to happen the moment anything cacheable —
// Caddy with a cache directive, a CDN, a corporate proxy — sits
// between the container and the user: the authenticated HTML could be
// handed out to the next visitor before middleware got a chance to
// redirect them.
export const dynamic = "force-dynamic";

const version = process.env["NEXT_PUBLIC_OCTOPUS_VERSION"] ?? "";

export default function HomePage() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center">
      <div
        className="inline-flex flex-col"
        style={{ fontSize: "calc(100vmin / 3.8125)" }}
      >
        <Logo version={version || undefined} size="inherit" />
      </div>
      <LogoutButton />
    </main>
  );
}
