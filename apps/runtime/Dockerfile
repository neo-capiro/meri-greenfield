# Native ARM64 child manifests; source provenance is in runtime-packages.lock.json.
ARG NODE_IMAGE=docker.io/library/node@sha256:401346cb1fc12bb388a82ed58ea72eeed2fe8530804d2964bcddce63a4eda4d8
ARG RUNTIME_IMAGE=docker.io/library/python@sha256:ff089de2ebe52f328c4834221097e20eae7f7e4148ea06ac42bd8440d3c79094
FROM ${NODE_IMAGE} AS builder
RUN test "$(uname -m)" = aarch64 && test "$(node --version)" = v24.22.1
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
# The pinned PptxGenJS module the fixed presentation generator loads by absolute path
# (artifacts.executor.pptxModulePath = /opt/meri/apps/artifacts/generation/node_modules/pptxgenjs).
COPY apps/artifacts/generation/package.json apps/artifacts/generation/package-lock.json ./apps/artifacts/generation/
RUN npm ci --prefix apps/artifacts/generation --omit=dev --ignore-scripts --no-audit --no-fund
COPY apps ./apps
COPY packages ./packages
COPY infra/product-preview/runtime-packages.lock.json ./infra/product-preview/runtime-packages.lock.json
# Stage 1 one-shot database runner (D2). Its migrations already arrive through `COPY apps`.
COPY infra/product-preview/first-chat-migrate.mjs infra/product-preview/first-chat-database.sql infra/product-preview/first-chat-database-temporal.sql infra/product-preview/first-chat-database-integration.sql infra/product-preview/first-chat-database-owner-reads.sql infra/product-preview/first-chat-seed-budget.sql ./infra/product-preview/
# SWC's upstream carrier extracts a native payload. Bake it while writable so
# the final UID1000 process needs no executable cache on its read-only root.
RUN --network=none node apps/runtime/build/materialize-swc.mjs
RUN mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk && ln -s ../../packages/contracts node_modules/@capiro/meri-contracts && ln -s ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk && ln -s ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3

FROM ${RUNTIME_IMAGE} AS runtime
USER root
WORKDIR /opt/meri
RUN test "$(uname -m)" = aarch64 && test "$(python3.13 --version)" = 'Python 3.13.16' && \
    apt-get update && apt-get install -y --no-install-recommends \
      bash=5.2.37-2+b10 ca-certificates=20250419 libatomic1=14.2.0-19 libstdc++6=14.2.0-19 && \
    rm -rf /var/lib/apt/lists/*
# Both stages use Debian trixie/glibc. Copy Node/npm only; preserve Python's
# own /usr/local interpreter, libraries and ordinary system CA trust.
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    ln -s /usr/local/bin/python3.13 /usr/bin/python3.13 && \
    test "$(node --version)" = v24.22.1
COPY --from=builder /opt/meri /opt/meri
COPY infra/product-preview/runtime-wheels.lock.json /opt/meri/infra/product-preview/runtime-wheels.lock.json
COPY infra/product-preview/runtime-packages/requirements.lock.txt /opt/meri/infra/product-preview/runtime-packages/requirements.lock.txt
COPY infra/product-preview/runtime-packages/executor-generation-smoke.mjs /opt/meri/infra/product-preview/runtime-packages/executor-generation-smoke.mjs
# pip owns wheel compatibility, hash verification and dependency validation.
# No source builds, network resolution or manual site-packages extraction.
RUN --mount=type=bind,source=infra/product-preview/runtime-packages/wheels,target=/tmp/runtime-wheels,readonly --network=none \
    python3.13 -I -m pip install --no-cache-dir --no-index --only-binary=:all: --require-hashes \
      --find-links=/tmp/runtime-wheels -r /opt/meri/infra/product-preview/runtime-packages/requirements.lock.txt && \
    python3.13 -I -m pip check
RUN groupadd --gid 1000 node && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash node
# Amazon RDS global CA bundle, pinned by apps/runtime/certs/rds-global-bundle.lock.json.
# node-postgres sslmode=verify-full on retained service connections uses
# Node's default trust store, which this extends; Node reads it once at start.
# Root-owned and read-only; a task that needs a different private anchor (the
# temporal worker) overrides NODE_EXTRA_CA_CERTS in its task environment.
COPY --chown=0:0 --chmod=0444 apps/runtime/certs/rds-global-bundle.pem /opt/meri/certs/rds-global-bundle.pem
RUN --network=none printf '%s\n' '90a6f1a7978a1b1b096dca6c57511ca48d3b8cf052f8e704baf358f34ea2f21b  /opt/meri/certs/rds-global-bundle.pem' | sha256sum -c - && \
    test "$(grep -c -- '-----BEGIN CERTIFICATE-----' /opt/meri/certs/rds-global-bundle.pem)" = 114 && \
    test "$(grep -c -- '-----BEGIN ' /opt/meri/certs/rds-global-bundle.pem)" = 114 && \
    chmod 0555 /opt/meri/certs
ENV NODE_EXTRA_CA_CERTS=/opt/meri/certs/rds-global-bundle.pem
ENV HOME=/home/node
# ECS copies this exact image path into the task-local bind mount. The one-shot
# material writer and application both run as the pinned non-root node UID/GID.
# /tmp and /workspace are task-local bind mounts too: without an image path to copy, Fargate mounts them root-owned
# and the node UID cannot create the per-run capability material directory (/tmp/meri-material) or a run workspace.
RUN test "$(id -u node)" = 1000 && test "$(id -g node)" = 1000 && mkdir -p /run/meri /run/meri-temporal /workspace && chown node:node /run/meri /run/meri-temporal /workspace && chmod 0700 /run/meri /run/meri-temporal /workspace && chmod 1777 /tmp
USER 1000:1000
VOLUME ["/run/meri", "/run/meri-temporal", "/tmp", "/workspace"]
ENTRYPOINT ["node", "apps/runtime/cli.mjs"]
CMD ["--help"]
