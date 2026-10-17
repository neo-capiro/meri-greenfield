# Keep the reviewed official Node/GNU builder and measure its exact executable.
# The final GNU runtime base is separately digest-pinned; no floating defaults.
ARG NODE_IMAGE
ARG RUNTIME_IMAGE
FROM ${NODE_IMAGE} AS builder
WORKDIR /opt/meri
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps/runtime/package.json apps/runtime/package-lock.json ./apps/runtime/
RUN npm ci --prefix apps/runtime --ignore-scripts --no-audit --no-fund
COPY apps/worker/conversation/package.json apps/worker/conversation/package-lock.json ./apps/worker/conversation/
RUN npm ci --prefix apps/worker/conversation --ignore-scripts --no-audit --no-fund
COPY packages/ui-stream/package.json packages/ui-stream/package-lock.json ./packages/ui-stream/
RUN npm ci --prefix packages/ui-stream --ignore-scripts --no-audit --no-fund
COPY packages/window-resolution/package.json packages/window-resolution/package-lock.json ./packages/window-resolution/
RUN npm ci --prefix packages/window-resolution --ignore-scripts --no-audit --no-fund
COPY apps/control/conversations/package.json apps/control/conversations/package-lock.json ./apps/control/conversations/
RUN npm ci --prefix apps/control/conversations --ignore-scripts --no-audit --no-fund
COPY apps/artifacts/storage/package.json apps/artifacts/storage/package-lock.json ./apps/artifacts/storage/
RUN npm ci --prefix apps/artifacts/storage --omit=dev --ignore-scripts --no-audit --no-fund
COPY apps ./apps
COPY packages ./packages
COPY infra/product-preview/runtime-packages.lock.json ./infra/product-preview/runtime-packages.lock.json
# Stage 1 one-shot database runner (D2). Its migrations already arrive through `COPY apps`.
COPY infra/product-preview/first-chat-migrate.mjs infra/product-preview/first-chat-database.sql infra/product-preview/first-chat-seed-budget.sql ./infra/product-preview/
# Stage the retained public index/APK snapshot through the same exact size/hash
# checks. The upstream index URL rotates; the build never downloads it. Kept
# outside /opt/meri so the snapshot is not copied into the runtime image.
COPY infra/product-preview/runtime-packages/x86_64 /opt/meri-runtime-input/x86_64
RUN --network=none node apps/runtime/build/runtime-packages.mjs fetch --lock infra/product-preview/runtime-packages.lock.json --directory /opt/meri-runtime-packages --from /opt/meri-runtime-input/x86_64
# Bake the pinned, upstream-verified SWC raw addon while the image layer is writable.
# Runtime retains the read-only root and non-executable temporary mount.
RUN --network=none node apps/runtime/build/materialize-swc.mjs
RUN mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk && ln -s ../../packages/contracts node_modules/@capiro/meri-contracts && ln -s ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk && ln -s ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3

FROM ${RUNTIME_IMAGE} AS runtime
USER root
WORKDIR /opt/meri
COPY --from=builder /usr/local /usr/local
COPY --from=builder /opt/meri /opt/meri
# Authenticate the pinned repository index through the base's existing public
# key. apk authenticates each indexed package's control/data identity. Never use
# allow-untrusted, floating upgrades, network fallback or copied Debian libraries.
RUN --mount=type=bind,from=builder,source=/opt/meri-runtime-packages,target=/tmp/runtime-repo,readonly --network=none \
    printf '%s\n' 'f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc  /etc/apk/keys/wolfi-signing.rsa.pub' | sha256sum -c - && \
    apk --repositories-file /dev/null --keys-dir /etc/apk/keys --repository /tmp/runtime-repo add --no-network --no-cache \
      bash=5.3-r14 libstdc++=16.2.0-r1 ncurses=6.6.20261010-r0 ncurses-terminfo-base=6.6.20261010-r0 && \
    node apps/runtime/build/runtime-packages.mjs verify --lock infra/product-preview/runtime-packages.lock.json
RUN addgroup -g 1000 node && adduser -D -u 1000 -G node -h /home/node node
ENV HOME=/home/node
# ECS copies this exact image path into the task-local bind mount. The one-shot
# material writer and application both run as the pinned non-root node UID/GID.
RUN test "$(id -u node)" = 1000 && test "$(id -g node)" = 1000 && mkdir -p /run/meri /run/meri-temporal && chown node:node /run/meri /run/meri-temporal && chmod 0700 /run/meri /run/meri-temporal
USER node
VOLUME ["/run/meri", "/run/meri-temporal"]
ENTRYPOINT ["node", "apps/runtime/cli.mjs"]
CMD ["--help"]
