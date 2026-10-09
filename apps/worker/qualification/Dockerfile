# Meri W02-01 qualification worker image recipe (PREPARATION ONLY).
#
# NOT built: no Docker daemon on the authoring host and no cloud build is
# authorized here. assembledImageDigest stays null until Codex performs a real
# isolated build (see component-pins.json).
#
# Intended build (build context is THIS qualification package directory so the
# owned .dockerignore applies):
#   docker build --pull --platform linux/amd64 \
#     -f apps/worker/qualification/Dockerfile \
#     -t <ecr>/meri-greenfield/qualification-worker:<sha> \
#     apps/worker/qualification
#
# Runtime expectation (set by the Codex-owned ECS task definition, NOT here):
#   readOnlyRootFilesystem=true, user 10001:10001, drop ALL capabilities,
#   no privileged mode, no Docker socket, no host networking, no added caps,
#   writable empty volumes mounted at /workspace and /tmp,
#   HOME=/workspace/home, TMPDIR=/tmp, CLAUDE_CONFIG_DIR=/workspace/config,
#   PLAYWRIGHT_BROWSERS_PATH=/opt/meri-browsers.

# Immutable upstream base: Node 24.9.0 on Debian bookworm slim, linux/amd64.
# Index digest resolved 2026-10-09 from registry-1.docker.io library/node.
FROM node:24.9.0-bookworm-slim@sha256:3e69116c924bfcba6c6979aff60d966c37aef56d488ce091c69d442ebec9f103

# The upstream slim Node image ships WITHOUT ca-certificates (the official
# bookworm-slim Dockerfile purges build-only packages). Debian's documentation
# for historical snapshots requires source-scoped Check-Valid-Until: no, and the
# September snapshot's security Release metadata is expired by build time. So:
#   1) bootstrap apt over the fixed signed snapshot via HTTP only (no CA needed),
#      installing the exact resolved ca-certificates version;
#   2) switch both fixed sources to HTTPS with normal CA verification for every
#      subsequent download.
# Signed-By keyring verification is retained throughout; no trust bypass, no
# unauthenticated downloads, no TLS bypass.
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; \
    printf '%s\n' \
      'Acquire::http::User-Agent "meri-qualification-snapshot/1";' \
      'Acquire::https::User-Agent "meri-qualification-snapshot/1";' \
      > /etc/apt/apt.conf.d/99meri-snapshot-ua; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian/20260901T000000Z' \
      'Suites: bookworm' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      '' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian-security/20260901T000000Z' \
      'Suites: bookworm-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      > /etc/apt/sources.list.d/meri-snapshot.sources; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates=20230311+deb12u1; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# Switch both fixed snapshot sources to HTTPS with normal CA verification.
RUN set -eux; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: https://snapshot.debian.org/archive/debian/20260901T000000Z' \
      'Suites: bookworm' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      '' \
      'Types: deb' \
      'URIs: https://snapshot.debian.org/archive/debian-security/20260901T000000Z' \
      'Suites: bookworm-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      > /etc/apt/sources.list.d/meri-snapshot.sources

# OS packages for Linux x86_64. Versions pinned to snapshot 20260901T000000Z
# (Debian bookworm 12.15); see component-pins.json osPackages.resolved.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      python3=3.11.2-1+b1 python3-venv=3.11.2-1+b1 \
      libreoffice-core=4:7.4.7-1+deb12u14 libreoffice-writer=4:7.4.7-1+deb12u14 \
      libreoffice-calc=4:7.4.7-1+deb12u14 libreoffice-impress=4:7.4.7-1+deb12u14 \
      fonts-liberation=1:1.07.4-11 fonts-dejavu-core=2.37-6 fonts-noto-core=20201225-1 \
      fonts-crosextra-carlito=20220224-1 fonts-crosextra-caladea=20200211-1 \
      poppler-utils=22.12.0-2+deb12u3 \
      libnss3=2:3.87.1-1+deb12u2 libnspr4=2:4.35-1 libatk1.0-0=2.46.0-5 \
      libatk-bridge2.0-0=2.46.0-5 libcups2=2.4.2-3+deb12u9 libdrm2=2.4.114-1+b1 \
      libxkbcommon0=1.5.0-1 libxcomposite1=1:0.4.5-1 libxdamage1=1:1.1.6-1 \
      libxfixes3=1:6.0.0-2 libxrandr2=2:1.5.2-2+b1 libgbm1=22.3.6-1+deb12u2 \
      libpango-1.0-0=1.50.12+ds-1 libcairo2=1.16.0-7 libasound2=1.2.8-1+b1 \
      libatspi2.0-0=2.46.0-5 libx11-6=2:1.8.4-2+deb12u2 libxcb1=1.15-1 \
      libxext6=2:1.3.4-1+b1 libglib2.0-0=2.74.6-2+deb12u9 libexpat1=2.5.0-1+deb12u2; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/meri-worker

# Record the exact OS package versions produced by the real build.
RUN set -eux; \
    dpkg-query -W -f='${Package}=${Version}\n' \
      ca-certificates python3 libreoffice-core fonts-liberation poppler-utils \
      libnss3 libatk1.0-0 \
      > /opt/meri-worker/os-package-versions.txt; \
    cat /opt/meri-worker/os-package-versions.txt

# Node candidate packages: one locked install from the nested lockfile,
# including optional platform binaries (the SDK's linux-x64 CLI). No fallback.
COPY package.json package-lock.json ./
RUN set -eux; npm ci --no-audit --no-fund --include=optional

# Python candidate libraries: hash-pinned, isolated venv (avoids PEP 668).
RUN python3 -m venv /opt/meri-venv
COPY requirements.lock.txt ./
RUN set -eux; \
    /opt/meri-venv/bin/pip install --no-cache-dir --require-hashes -r requirements.lock.txt; \
    rm -rf /opt/meri-venv/lib/python3.11/site-packages/pip /root/.cache
ENV PATH="/opt/meri-venv/bin:${PATH}"

# Selected qualification sources only (scoped COPY, never the whole repository).
COPY sdk-options.mjs ./
COPY probes/ ./probes/

# Matched Chromium (revision 1247 / Chrome-for-Testing 155.0.8059.12) via the
# adopted Playwright CLI. Debian12 maps to the CFT archive
# builds/cft/155.0.8059.12/linux64/chrome-linux64.zip -> chromium-1247/
# chrome-linux64/{chrome,chrome_sandbox}. The CFT helper is chrome_sandbox
# (underscore). The browser tree STAYS root-owned so the setuid helper keeps its
# intended owner/mode.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/meri-browsers
RUN set -eux; \
    node node_modules/playwright/cli.js install chromium; \
    chmod -R a+rX /opt/meri-browsers; \
    sb="$(find /opt/meri-browsers \( -name chrome_sandbox -o -name chrome-sandbox \) -print -quit)"; \
    test -n "$sb"; \
    chmod 4755 "$sb"

# Non-root identity 10001:10001.
RUN set -eux; \
    groupadd --gid 10001 meri; \
    useradd --uid 10001 --gid 10001 --home-dir /workspace/home --shell /usr/sbin/nologin meri

# UID/GID 10001 ownership on both writable mount points and the app sources.
# The browser tree deliberately keeps root ownership (its setuid helper must
# stay root-owned); only /workspace, /tmp and /opt/meri-worker are reassigned.
# ECS mounts empty volumes at /workspace and /tmp; declaring VOLUME lets Docker
# initialise an empty volume from this image directory (content + ownership).
# THIS VOLUME-INITIALISATION BEHAVIOUR REQUIRES LIVE VERIFICATION.
RUN set -eux; \
    mkdir -p /workspace/conversation /workspace/home /workspace/config /tmp; \
    chown -R 10001:10001 /workspace /tmp /opt/meri-worker

# Final assertion: after ALL ownership operations the sandbox helper is still
# root-owned with mode 4755 and the browser tree is root-owned.
RUN set -eux; \
    sb="$(find /opt/meri-browsers \( -name chrome_sandbox -o -name chrome-sandbox \) -print -quit)"; \
    test -n "$sb"; \
    test "$(stat -c '%U' "$sb")" = root; \
    test "$(stat -c '%a' "$sb")" = 4755; \
    test -u "$sb"; \
    test "$(stat -c '%U' /opt/meri-browsers)" = root

ENV HOME=/workspace/home \
    TMPDIR=/tmp \
    CLAUDE_CONFIG_DIR=/workspace/config \
    PLAYWRIGHT_BROWSERS_PATH=/opt/meri-browsers \
    NODE_ENV=production \
    MERI_QUALIFICATION_ONLY=true \
    MERI_SOURCES_ENABLED=false \
    CHROMIUM_SANDBOX_REQUIRED=true

USER 10001:10001
WORKDIR /workspace/conversation

VOLUME ["/workspace", "/tmp"]

# Image qualification entrypoint. Exits nonzero on any required failure.
ENTRYPOINT ["node", "/opt/meri-worker/probes/runtime.mjs"]
