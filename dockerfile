# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --workspace=server --workspace=client

# Copy source code
COPY . .

# Build both server and client
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --workspace=server --omit=dev && \
    npm cache clean --force

# Copy built server
COPY --from=builder /app/server/dist ./server/dist

# Copy built client to be served by Express
COPY --from=builder /app/client/dist ./client/dist

# Create data directory
RUN mkdir -p server/data

# Set production environment
ENV NODE_ENV=production

# Expose only the server port (which will serve everything)
EXPOSE 3001

# Start server
CMD ["npm", "start"]