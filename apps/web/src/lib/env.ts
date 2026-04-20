import { z } from "zod";

const schema = z.object({
  AUTH_SECRET: z.string().min(16),
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),
  AUTH_ALLOWED_GITHUB_LOGINS: z.string().min(1),
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
  // Fail fast: the server shouldn't boot half-configured.
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid auth environment: ${issues}`);
}

const data = parsed.data;

export const env = {
  AUTH_SECRET: data.AUTH_SECRET,
  AUTH_GITHUB_ID: data.AUTH_GITHUB_ID,
  AUTH_GITHUB_SECRET: data.AUTH_GITHUB_SECRET,
  AUTH_URL: data.AUTH_URL,
  allowedGithubLogins: data.AUTH_ALLOWED_GITHUB_LOGINS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};
