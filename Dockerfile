FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose port
EXPOSE 3000

# Start server & cron scheduler
CMD ["node", "server/index.js"]
