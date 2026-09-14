FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (workspaces)
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci

COPY . .
RUN npm run build:client

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# install curl for healthchecks
RUN apk add --no-cache curl

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --omit=dev

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3000
CMD ["npm", "--workspace", "server", "run", "start"]
