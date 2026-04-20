import Link from "next/link";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function HomePage() {
  const session = env.githubConfigured ? await auth() : null;
  const login = session?.user?.githubLogin;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
        amorson<span className="text-accent">.</span>me
      </h1>
      <p className="mt-4 max-w-md text-sm text-white/50 md:text-base">
        Personal hub. No-code agent editor. More to come.
      </p>

      {!env.githubConfigured ? (
        <p className="mt-10 max-w-md text-xs text-white/40">
          Sign-in disabled — GitHub OAuth credentials aren&apos;t configured on
          the server yet.
        </p>
      ) : login ? (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-sm text-white/70">
            Signed in as <span className="text-accent">@{login}</span>
          </p>
          <Link
            href="/editor"
            className="rounded-full border border-accent/60 bg-accent/10 px-6 py-2 text-sm text-accent transition hover:bg-accent/20"
          >
            Open agent editor →
          </Link>
        </div>
      ) : (
        <p className="mt-10 text-xs text-white/40">
          Tap the GitHub icon to sign in.
        </p>
      )}
    </main>
  );
}
