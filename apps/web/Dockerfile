# ------------ base ------------
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ------------ deps ------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile || pnpm install

# ------------ build ------------
FROM base AS build
ARG API_BASE_URL=http://localhost:3000
ENV API_BASE_URL=$API_BASE_URL
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @swordgame/web build

# ------------ runtime ------------
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist/browser /usr/share/nginx/html
EXPOSE 80
