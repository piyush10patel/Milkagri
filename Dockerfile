# Stage 1: Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and config files
COPY tsconfig.json tsconfig.server.json tsconfig.client.json ./
COPY postcss.config.js tailwind.config.ts vitest.config.ts ./
COPY src/ src/
COPY prisma/ prisma/

# Generate Prisma client
RUN npx prisma generate

# Build client (Vite → dist/client) and server (tsc → dist/server)
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema and migrations for runtime migrate
COPY prisma/ prisma/
RUN npx prisma generate

# Copy built artifacts from builder
COPY --from=builder /app/dist/ dist/

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/index.js"]
