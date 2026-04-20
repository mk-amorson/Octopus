# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Copy only manifests + lockfile for better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --filter @octopus/web... --frozen-lockfile

# ---------- builder ----------
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Subpath the app is mounted under. Baked into the build because Next.js
# basePath is a build-time concern — asset URLs resolve against it.
ARG OCTOPUS_BASE_PATH=""
ENV OCTOPUS_BASE_PATH=$OCTOPUS_BASE_PATH

# App version string shown under the Octopus logo so users can tell at a
# glance which release they are running. Embedded at build time via
# Next.js' NEXT_PUBLIC_* env-inlining.
ARG OCTOPUS_VERSION=""
ENV NEXT_PUBLIC_OCTOPUS_VERSION=$OCTOPUS_VERSION

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web ./apps/web

RUN pnpm --filter @octopus/web build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

# Next.js standalone output bundles only what the server needs.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
