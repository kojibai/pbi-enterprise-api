FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

# App source + assets
COPY openapi.yaml ./openapi.yaml
COPY src ./src
COPY scripts ./scripts

# ✅ Static assets (Kojib icons, etc.)
COPY public ./public

# Build TS -> dist
RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "run", "start"]
