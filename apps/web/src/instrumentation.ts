// Next.js runs this once on server boot (in both dev and the
// standalone production bundle) when `experimental.instrumentationHook`
// is true. We use it to bootstrap the NodeManager — otherwise the
// first API request would lazily start it, and any webhook that
// arrived before the first page load would miss its trigger.

export async function register() {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;
  const { manager } = await import("@/lib/nodes/manager");
  await manager.bootstrap();
}
