# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Install pnpm
RUN corepack enable

# 2. Copy manifests only
COPY package.json pnpm-lock.yaml ./

# 3. Install deps (incl. dev deps)
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --prod=false

# 3b. Copy Prisma schema, then generate client
COPY prisma ./prisma
RUN pnpm prisma generate

# 4. Copy the rest of the backend
COPY . .

# 5. Build TS with Nest CLI
RUN pnpm run build

# ---- Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

# 6. Copy only dist + prod deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

ENV NODE_OPTIONS="--max-old-space-size=1024"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "dist/main.js"]
