// Env is read lazily and never throws at import time. Any schema validation
// that happens at module load blocks `next build` (Next statically renders
// 404/etc., which imports the root layout, which imports auth…) even though
// the real runtime env is only injected by docker-compose when the
// container actually starts. So we return defaults and let code that
// actually needs auth check `githubConfigured` first.

const rawAuthSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
const rawGithubId = process.env.AUTH_GITHUB_ID ?? "";
const rawGithubSecret = process.env.AUTH_GITHUB_SECRET ?? "";
const rawAuthUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
const rawAllowed = process.env.AUTH_ALLOWED_GITHUB_LOGINS ?? "";

const allowedGithubLogins = rawAllowed
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const githubConfigured = Boolean(
  rawAuthSecret && rawGithubId && rawGithubSecret && allowedGithubLogins.length > 0,
);

export const env = {
  AUTH_SECRET: rawAuthSecret,
  AUTH_GITHUB_ID: rawGithubId,
  AUTH_GITHUB_SECRET: rawGithubSecret,
  AUTH_URL: rawAuthUrl || undefined,
  allowedGithubLogins,
  githubConfigured,
};
