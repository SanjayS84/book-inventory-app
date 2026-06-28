# ==============================================================================
# STAGE 1: BUILD ENVIRONMENT
# ==============================================================================
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder

# Switch to root user to ensure directory creation permissions
USER root

WORKDIR /opt/app-root/src

# Copy dependency configuration files
COPY package*.json ./

# Install development & production dependencies for the build phase
RUN npm ci

# Copy full application source code
COPY . .

# Build client-side assets and compile the Express server into dist/
RUN npm run build

# Prune node_modules to keep only production dependencies
RUN npm prune --omit=dev

# ==============================================================================
# STAGE 2: PRODUCTION RUNTIME ENVIRONMENT
# ==============================================================================
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest

LABEL maintainer="DevOps Engineering Candidate" \
      summary="UBI-9 microservice for GitOps book management" \
      description="Enterprise-hardened Node.js application managing book inventories with PostgreSQL, RabbitMQ, and Vault sidecar integration."

WORKDIR /opt/app-root/src

# Copy built artifacts and production dependencies from builder stage
COPY --from=builder /opt/app-root/src/dist ./dist
COPY --from=builder /opt/app-root/src/node_modules ./node_modules
COPY --from=builder /opt/app-root/src/package.json ./package.json

# Red Hat UBI best practice: Run as a non-privileged user (1001 is default)
USER 1001

# Expose the standard application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Execute the pre-compiled Express bundler server
CMD ["node", "dist/server.cjs"]
