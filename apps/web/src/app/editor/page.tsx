import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=%2Feditor");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center">
      <h1 className="text-2xl font-semibold md:text-3xl">Agent editor</h1>
      <p className="mt-3 max-w-md text-sm text-white/60">
        3D force-graph editor lands here next. For now — placeholder.
      </p>
      <div className="mt-8 h-64 w-full max-w-xl rounded-2xl border border-dashed border-white/15 bg-white/[0.02]" />
    </main>
  );
}
