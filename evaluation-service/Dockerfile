FROM node:20-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package files (using package*.json to include lockfiles)
COPY evaluation-service/package*.json ./evaluation-service/
COPY core/package*.json ./core/

# Install dependencies for core
WORKDIR /app/core
RUN npm ci

# Install dependencies for evaluation-service
WORKDIR /app/evaluation-service
RUN npm ci

# Copy source code
WORKDIR /app
COPY core ./core
COPY evaluation-service ./evaluation-service

WORKDIR /app/evaluation-service

# Default command
CMD ["npm", "start"]
