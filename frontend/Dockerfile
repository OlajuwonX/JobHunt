# ─────────────────────────────────────────────────────────────────────────────
# Frontend Dockerfile — Multi-stage Build
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the Next.js app (creates .next/standalone output)
RUN npm run build

# ─── Production runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy the standalone Next.js output (self-contained, no node_modules needed)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "server.js"]
