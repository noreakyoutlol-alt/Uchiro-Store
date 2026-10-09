# ==============================================================================
# UCHIRO STORE V3 — PRODUCTION MULTI-STAGE DOCKERFILE FOR RAILWAY
# ==============================================================================

# Node 22 is required for @supabase/supabase-js >= 2.117.2
FROM node:22-alpine AS builder

WORKDIR /app

# Cap Node memory allocation to avoid Railway container OOM kills (Code 137)
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Copy package manifests for workspace caching
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client-store/package.json ./client-store/
COPY client-admin/package.json ./client-admin/

# Install dependencies safely without spawning resource-heavy postinstall scripts
RUN npm install --ignore-scripts --prefer-offline

# Copy full repository source
COPY . .

# Build all workspaces
RUN npm run build --prefix client-store
RUN npm run build --prefix client-admin
RUN npm run build --prefix server

# ==============================================================================
# Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client-store/package.json ./client-store/
COPY client-admin/package.json ./client-admin/

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts --prefer-offline

# Copy compiled bundles from builder stage
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client-store/dist ./client-store/dist
COPY --from=builder /app/client-admin/dist ./client-admin/dist

# Expose port
EXPOSE 5000

# Start production server
CMD ["node", "server/dist/production.js"]