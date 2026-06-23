# Use Microsoft's official Playwright base image containing pre-installed Chromium and OS library dependencies
FROM mcr.microsoft.com/playwright:v1.61.0-jammy

# Create app directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Install Google Chrome stable for production launch
RUN npx playwright install chrome

# Copy application files
COPY . .

# Expose server gateway port
EXPOSE 3000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HEADLESS=true

# Default start command
CMD [ "npm", "run", "start-server" ]
