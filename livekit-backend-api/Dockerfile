# Use Node.js 22 LTS Alpine for security and performance
FROM node:22-alpine

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy package files (including pnpm-lock.yaml)
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Build TypeScript
RUN pnpm run build

# Remove dev dependencies and source files
RUN pnpm prune --prod && rm -rf src tsconfig.json node_modules/.pnpm

# Reinstall only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S livekit -u 1001

# Change ownership of app directory
RUN chown -R livekit:nodejs /app

USER livekit

EXPOSE 3001

CMD ["pnpm", "start"]