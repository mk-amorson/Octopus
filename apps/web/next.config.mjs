import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Subpath the app is mounted under (e.g. "/octopus"). Empty string = root.
// Configured at build time via the installer so assets resolve correctly.
const rawBasePath = process.env.OCTOPUS_BASE_PATH ?? "";
const basePath = rawBasePath === "/" ? "" : rawBasePath;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  basePath,
  experimental: {
    // Point file tracing at the workspace root so standalone output includes
    // the correct slice of the monorepo node_modules.
    outputFileTracingRoot: path.join(__dirname, "../.."),
    // Enables src/instrumentation.ts — we bootstrap the NodeManager
    // on server boot from there so triggers are live before the first
    // HTTP request arrives.
    instrumentationHook: true,
  },
};

export default nextConfig;
