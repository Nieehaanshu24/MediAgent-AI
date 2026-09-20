# ────────────────────────────────────────────────────────────────
# Stage 1 — Build React + TypeScript frontend
# ────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run build

# ────────────────────────────────────────────────────────────────
# Stage 2 — Production Express server
# ────────────────────────────────────────────────────────────────
FROM node:20-slim AS server

WORKDIR /app

# Copy only production deps
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Copy compiled frontend and server source
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/server ./server
COPY --from=frontend-builder /app/public ./public

# Runtime environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
