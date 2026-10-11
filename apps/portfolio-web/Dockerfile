# Build context: apps/portfolio-web. This pinned Node 24 Alpine base uses a
# vendor-fixed zlib package for CVE-2026-85091. Confirm the package version,
# container behavior and image scan before runtime admission.
FROM node:24.21.0-alpine3.23@sha256:9ec4a2e289874ed0d722e1772ec2de45d2801541db8612f3638b26f128c69ac2 AS base
RUN apk add --no-cache --upgrade zlib=1.3.2-r1 ca-certificates
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production PORT=5188 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 5188
CMD ["node", "server.js"]
