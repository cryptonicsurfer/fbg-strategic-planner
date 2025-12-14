# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Build server
RUN npm run build:server

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy built server from builder
COPY --from=builder /app/dist/server ./dist/server

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the server
CMD ["node", "dist/server/index.js"]
