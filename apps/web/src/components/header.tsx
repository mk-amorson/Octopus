import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { NavDrawer } from "./nav-drawer";
import { LoginButton } from "./login-button";

export async function Header() {
  const session = await auth();
  const loggedIn = Boolean(session?.user);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <NavDrawer loggedIn={loggedIn} />
        <Link
          href="/"
          className="font-mono text-sm tracking-widest text-white/70 transition hover:text-white"
        >
          amorson.me
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {loggedIn ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-accent hover:text-accent"
              aria-label="Sign out"
            >
              {session?.user?.githubLogin ? `@${session.user.githubLogin}` : "Sign out"}
            </button>
          </form>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <LoginButton />
          </form>
        )}
      </div>
    </header>
  );
}
