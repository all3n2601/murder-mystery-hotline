# One image: builds the web app, then runs the Fastify server (which serves it) with tsx.
FROM node:22-slim
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @mmh/web build

ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "apps/server/src/main.ts"]
