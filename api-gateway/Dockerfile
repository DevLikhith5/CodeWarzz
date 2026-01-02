FROM node:20-alpine

WORKDIR /app

# Copy package files (using package*.json to include lockfiles)
COPY api-gateway/package*.json ./api-gateway/
COPY core/package*.json ./core/

# Install dependencies for core
WORKDIR /app/core
RUN npm ci

# Install dependencies for api-gateway
WORKDIR /app/api-gateway
RUN npm ci

# Copy source code
WORKDIR /app
COPY core ./core
COPY api-gateway ./api-gateway

WORKDIR /app/api-gateway

# Default command
CMD ["npm", "start"]
