// / — the authenticated landing. Empty state: tells the user to pick
// a node in the sidebar or create one. Once a node exists and the
// user navigates into it, the individual node route owns the main
// area and this file doesn't render.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-pixel text-2xl text-white/90">welcome</h1>
        <p className="text-white/60 text-sm leading-relaxed">
          Pick a node from the sidebar, or add a new one. First up: the
          Telegram trigger — paste a bot token and watch messages arrive in
          real time.
        </p>
        <Link
          href="/nodes/new"
          className="inline-block font-pixel text-sm text-white/90 hover:text-white border border-white/30 hover:border-white/60 px-4 py-2 transition-colors"
        >
          + add a node
        </Link>
      </div>
    </div>
  );
}
