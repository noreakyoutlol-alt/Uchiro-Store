# ==============================================================================
# UCHIRO STORE V3 — PRODUCTION MULTI-STAGE DOCKERFILE FOR RAILWAY
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests for workspace caching
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client-store/package.json ./client-store/
COPY client-admin/package.json ./client-admin/

# Install dependencies across all workspaces
RUN npm install

# Copy full repository source
COPY . .

# Build all workspaces (client-store/dist, client-admin/dist, server/dist)
RUN npm run build

# ==============================================================================
# Production Runner
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client-store/package.json ./client-store/
COPY client-admin/package.json ./client-admin/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled bundles from builder stage
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client-store/dist ./client-store/dist
COPY --from=builder /app/client-admin/dist ./client-admin/dist

# Expose port
EXPOSE 5000

# Start production unified server
CMD ["node", "server/dist/production.js"]
