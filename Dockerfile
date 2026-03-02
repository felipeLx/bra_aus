# ─── Stage 1: install dependencies ────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ─── Stage 2: build ────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .
# Generate Prisma client before building
RUN bun prisma generate
RUN bun run build

# ─── Stage 3: production image ─────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# App server bundle
COPY --from=builder /app/build ./build

# i18n locale files (read from filesystem by i18next-fs-backend at runtime)
COPY --from=builder /app/public ./public

# Prisma: generated client + schema + migrations (needed for release command)
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Runtime dependencies only
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 8080

CMD ["bun", "run", "start"]
