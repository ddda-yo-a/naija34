# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy only the manifests first to leverage Docker layer caching.
COPY package.json package-lock.json ./

# Install *only* production dependencies (no devDependencies).
RUN npm ci --omit=dev

# ── Stage 2: lean runtime image ───────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Keeps the container clock in sync and reduces image size.
ENV TZ=UTC \
    NODE_ENV=production

WORKDIR /app

# Create a non-root user to run the process.
RUN addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S nodejs -G nodejs

# Copy production node_modules from the deps stage.
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source.
COPY --chown=nodejs:nodejs src/ ./src/
COPY --chown=nodejs:nodejs package.json ./

USER nodejs

# Cloud Run injects $PORT automatically (default 8080).
# The app reads PORT from env with a fallback of 4000, so this is just documentation.
EXPOSE 8080

CMD ["node", "src/server.js"]
