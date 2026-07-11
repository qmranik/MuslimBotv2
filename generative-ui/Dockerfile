# Stage 1: Build the React/Next.js app
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first
COPY package.json ./
# Install dependencies
RUN npm install

# Copy source and build
COPY . .

# Set env to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 2: Serve via Next.js Node server
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173
ENV HOSTNAME="0.0.0.0"

# Copy built server assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 5173

CMD ["npm", "run", "start", "--", "-p", "5173"]
