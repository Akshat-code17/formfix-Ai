FROM node:22.19.0-bookworm-slim AS build
WORKDIR /app
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:22.19.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir -p /data/uploads && chown node:node /data/uploads
COPY --from=build /app/dist/apps ./dist/apps
COPY --from=build /app/dist/packages ./dist/packages
COPY --from=build /app/dist/fixtures ./dist/fixtures
COPY scripts/worker-health.mjs ./scripts/worker-health.mjs
USER node
EXPOSE 3000
CMD ["npm","start"]
