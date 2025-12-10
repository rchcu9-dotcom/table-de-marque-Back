# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Installer PNPM
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 2. Copier uniquement les manifests
COPY package.json pnpm-lock.yaml ./

# 3. Installer deps (inclure dev deps pour le build Nest)
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --prod=false

# 3bis. Copier le reste du backend
COPY . .

# 4. Build TS (utilise npx pour exécuter le CLI local installé en devDependency)
RUN npx nest build


# ---- Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

# 6. Copier uniquement la dist + node_modules prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

CMD ["node", "dist/main.js"]
