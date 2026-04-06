# ─────────────────────────────────────────────────────────────────────────────
# Backend Dockerfile — Multi-stage Build
# ─────────────────────────────────────────────────────────────────────────────
#
# Uses a two-stage build:
#   Stage 1 (builder): installs ALL deps and compiles TypeScript → JavaScript
#   Stage 2 (runner):  copies only the compiled JS + production deps
#
# Why multi-stage?
#   The final image doesn't include TypeScript, nodemon, or source code.
#   This makes the production image smaller (~300MB vs ~800MB) and more secure.
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy package files first — Docker caches this layer
# If package.json didn't change, Docker skips npm install on rebuild (faster)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies needed to compile TS)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma client (creates TypeScript types from schema.prisma)
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy production dependencies list
COPY package*.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies (no TypeScript, no nodemon, etc.)
RUN npm ci --only=production

# Generate Prisma client in the runner stage too
RUN npx prisma generate

# Copy compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# The port our app listens on (must match PORT in .env)
EXPOSE 4000

# Health check — Docker uses this to know if the container is healthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Start the compiled app
CMD ["node", "dist/index.js"]
