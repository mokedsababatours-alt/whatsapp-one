# =============================================================================
# Headless WhatsApp Interface - Production Dockerfile
# Multi-stage build for minimal image size
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all dependencies including devDependencies for build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Add libc6-compat for Alpine compatibility
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# Build the Next.js application with standalone output
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set production environment for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# Production image with only necessary files
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets (must be at root for Next.js to find them)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone build output
# This includes server.js, node_modules, and .next/server files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files to .next/static (standalone doesn't include static assets)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set the port environment variable
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
# Start the application
CMD ["node", "server.js"]
