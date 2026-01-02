FROM node:20-alpine

# Install dependencies for core
WORKDIR /app/core

# Copy package files from core directory (cwd is root context)
COPY core/package*.json ./

# Rebuild modules to ensure native bindings are correct (e.g., for pg)
RUN npm ci && npm rebuild

# Copy source code
COPY core/ .

# Build the application
RUN npm run build

# Default command
CMD ["npm", "run", "start:prod"]
