FROM node:20-alpine

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY openapi.yaml ./openapi.yaml
COPY src ./src
COPY scripts ./scripts

RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "run", "start"]