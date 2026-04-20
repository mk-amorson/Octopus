import { z } from "zod";

// AUTH_SECRET is required (NextAuth needs it to sign JWTs). Everything else
// is optional: if GitHub creds aren't configured yet, the site still renders
// and shows "sign-in not configured" instead of the login button. This lets
// us deploy the app before the OAuth app is wired up.
const schema = z.object({
  AUTH_SECRET: z.string().min(16),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  AUTH_ALLOWED_GITHUB_LOGINS: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
});

const parsed = schema.safeParse({
  AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
  AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
  AUTH_ALLOWED_GITHUB_LOGINS: process.env.AUTH_ALLOWED_GITHUB_LOGINS,
  AUTH_URL: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid auth environment: ${issues}`);
}

const data = parsed.data;

const allowedGithubLogins = (data.AUTH_ALLOWED_GITHUB_LOGINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const githubConfigured = Boolean(
  data.AUTH_GITHUB_ID && data.AUTH_GITHUB_SECRET && allowedGithubLogins.length > 0,
);

export const env = {
  AUTH_SECRET: data.AUTH_SECRET,
  AUTH_GITHUB_ID: data.AUTH_GITHUB_ID,
  AUTH_GITHUB_SECRET: data.AUTH_GITHUB_SECRET,
  AUTH_URL: data.AUTH_URL,
  allowedGithubLogins,
  githubConfigured,
};
