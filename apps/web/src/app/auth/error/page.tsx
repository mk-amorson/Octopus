import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const reason = searchParams.error ?? "AccessDenied";
  const accessDenied = reason === "AccessDenied";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold">
        {accessDenied ? "Access denied" : "Sign-in failed"}
      </h1>
      <p className="max-w-md text-sm text-white/60">
        {accessDenied
          ? "This GitHub account isn't on the allowlist for amorson.me. Ask the owner to add your login."
          : `Something went wrong during sign-in (${reason}). Try again in a moment.`}
      </p>
      <Link
        href="/"
        className="rounded-full border border-white/20 px-5 py-2 text-sm transition hover:border-accent hover:text-accent"
      >
        Back to home
      </Link>
    </main>
  );
}
