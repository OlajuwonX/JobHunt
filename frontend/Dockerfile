# ─────────────────────────────────────────────
# Frontend Dockerfile (Next.js Standalone)
# ─────────────────────────────────────────────

FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build


# ─────────────────────────────────────────────
# Runtime (lightweight)
# ─────────────────────────────────────────────
FROM node:20 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone output (fast runtime)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]