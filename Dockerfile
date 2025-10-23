# Pakistan Train Tracker - Docker Configuration for Google Cloud
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create public directory if it doesn't exist
RUN mkdir -p public

# Expose port (Cloud Run will set PORT environment variable)
EXPOSE 8080

# Set default port for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application
CMD ["node", "production-server.js"]