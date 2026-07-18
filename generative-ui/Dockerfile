# generative-ui (Next.js 16) — production image for the unified pane.
#
# NEXT_PUBLIC_* are inlined into the browser bundle at BUILD time, so they are
# accepted as build args here (not just runtime env). Pass them from the compose
# build block. Serves on :3000 to match the Traefik `genui` service port.

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Bake public config into the client bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTHENTIK_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_AUTHENTIK_URL=${NEXT_PUBLIC_AUTHENTIK_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
