# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first to maximise layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --filter server

COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src/ ./packages/server/src/

RUN pnpm --filter server build

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --filter server --prod

COPY --from=builder /app/packages/server/dist ./packages/server/dist

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "packages/server/dist/index.js"]
