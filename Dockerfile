# One image serves the api and the built web app (docs/mvp-scope.md, "Hosting").
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# The api with only its production dependencies, workspace packages copied in.
RUN pnpm --filter @june/api --prod deploy /out/api

FROM node:22-slim
ENV NODE_ENV=production
ENV WEB_DIST=/app/web
ENV PORT=3000
WORKDIR /app
COPY --from=build /out/api ./api
COPY --from=build /app/apps/web/dist ./web
EXPOSE 3000
# Pending migrations run before the server starts; a failed migration keeps the old deployment up.
CMD ["sh", "-c", "node api/dist/db/migrate.js && node api/dist/main.js"]
