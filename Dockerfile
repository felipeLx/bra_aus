# ─── Stage 1: install dependencies ────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ─── Stage 2: build ────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .
ENV DIRECT_URL="postgresql://postgres:YqMnldnyM1Qa43mH@db.wtqggazeuxnoeonwgtam.supabase.co:5432/postgres"
ENV DATABASE_URL="postgresql://postgres:YqMnldnyM1Qa43mH@db.wtqggazeuxnoeonwgtam.supabase.co:5432/postgres"

# Generate Prisma client before building (requires env var resolution)
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

# Prisma schema + migrations (client generated in build)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated

# Runtime dependencies only
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 8080

CMD ["bun", "run", "start"]
