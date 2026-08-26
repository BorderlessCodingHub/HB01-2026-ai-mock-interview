# syntax=docker/dockerfile:1

# Install all dependencies (lockfile-cached). Skip lifecycle scripts so postinstall
# does not run prisma generate before source and DATABASE_URL are available.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Generate Prisma client and bundle the API entrypoint.
FROM deps AS build
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate && bun run build

# Production dependencies, including the Prisma CLI needed for migrate deploy.
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src/modules ./modules
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Default: apply pending migrations, then API. Worker override (same image):
#   docker run --rm backend-api bun run worker
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "start"]
