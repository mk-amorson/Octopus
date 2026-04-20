import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // Point file tracing at the workspace root so standalone output includes
    // the correct slice of the monorepo node_modules.
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
