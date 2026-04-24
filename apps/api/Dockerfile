# ------------ base ------------
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ------------ deps ------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile || pnpm install

# ------------ build ------------
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @swordgame/shared build \
 && pnpm --filter @swordgame/api prisma generate \
 && pnpm --filter @swordgame/api build

# ------------ runtime ------------
# Keep the pnpm workspace layout intact so the symlinked @swordgame/shared
# resolves to packages/shared/dist/index.js at runtime.
FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production

# Workspace metadata
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
# API (compiled + its deps + generated prisma client + schema)
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
# Shared package built output (the symlink in apps/api/node_modules/@swordgame/shared
# points to ../../../packages/shared, so this path MUST exist at runtime).
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist

WORKDIR /repo/apps/api
EXPOSE 3000
# First-deploy workflow: db push (idempotent, no migration files required).
# When you later add real migration files under apps/api/prisma/migrations/,
# swap the push for `migrate deploy`.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate && node dist/main.js"]
