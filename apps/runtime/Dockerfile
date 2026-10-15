# Build from a separately reviewed Node 24 image digest. No floating default.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
# Claude Agent SDK Bash sandbox dependencies (bubblewrap, socat) for the disposable conversation worker.
# Same convention as apps/worker/qualification/Dockerfile: the fixed, signed Debian snapshot 20261009T000000Z
# with Signed-By keyring verification and exact versions read from that snapshot's trixie Packages index.
# Plain HTTP is used only because the slim base has no CA bundle; apt still verifies the signed InRelease.
# Requires a Debian 13 (trixie) NODE_IMAGE; any other base fails here rather than resolving other packages.
# Presence is not qualification: sandbox-readiness/cli.mjs must attest SDK sandbox startup on the actual host.
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian/20261009T000000Z' \
      'Suites: trixie' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      '' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian-security/20261009T000000Z' \
      'Suites: trixie-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      > /etc/apt/sources.list.d/meri-snapshot.sources; \
    apt-get update; \
    apt-get install -y --no-install-recommends --no-remove bubblewrap=0.12.0-1~deb13u1 socat=1.8.0.3-1+deb13u1; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*
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
# Bake the pinned, upstream-verified SWC raw addon while the image layer is writable.
# Runtime retains the read-only root and non-executable temporary mount.
RUN --network=none node apps/runtime/build/materialize-swc.mjs
RUN mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk && ln -s ../../packages/contracts node_modules/@capiro/meri-contracts && ln -s ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk && ln -s ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3
USER node
ENTRYPOINT ["node", "apps/runtime/cli.mjs"]
CMD ["--help"]
