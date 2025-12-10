# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Installer PNPM
RUN corepack enable

# 2. Copier uniquement les manifests
COPY package.json pnpm-lock.yaml ./

# 3. Installer deps (inclut dev deps par défaut)
RUN pnpm install --frozen-lockfile

# 4. Copier le reste du backend
COPY . .

# 5. Build TS avec le CLI Nest (script package.json)
RUN pnpm run build


# ---- Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

# 6. Copier uniquement la dist + node_modules prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

CMD ["node", "dist/main.js"]
