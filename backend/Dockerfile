# ─────────────────────────────────────────────
# Backend Dockerfile (Express + TypeScript + Prisma)
# ─────────────────────────────────────────────

FROM node:20 AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (ONLY here)
RUN npx prisma generate

# Build TypeScript
RUN npm run build


# ─────────────────────────────────────────────
# Production runtime (clean + fast)
# ─────────────────────────────────────────────
FROM node:20 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production deps only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

# Copy build output only
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 4000

CMD ["node", "dist/index.js"]