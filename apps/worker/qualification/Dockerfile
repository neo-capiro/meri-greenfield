# Meri W02-01 qualification worker image recipe (PREPARATION ONLY).
#
# NOT built by this session. A PRIOR probe-only candidate was built by Codex
# (ECR sha256:f669d3602892c36c7a829bc3e2747124fa2e1dd5397af193f7b893afdd19b837,
# CodeBuild aaec4b57-0bb1-4a80-a464-21d364be6465). THIS refreshed recipe is NOT
# YET BUILT and has no assembled digest; see component-pins.json.
#
# Intended build (build context is THIS qualification package directory):
#   docker build --pull --platform linux/amd64 \
#     -f apps/worker/qualification/Dockerfile \
#     -t <ecr>/meri-greenfield/qualification-worker:<sha> \
#     apps/worker/qualification
#
# Runtime expectation (Codex-owned ECS task definition, NOT here):
#   readOnlyRootFilesystem=true, user 10001:10001, drop ALL capabilities,
#   no privileged mode, no Docker socket, no host networking, no added caps,
#   writable empty volumes at /workspace and /tmp, HOME=/workspace/home,
#   TMPDIR=/tmp, CLAUDE_CONFIG_DIR=/workspace/config,
#   PLAYWRIGHT_BROWSERS_PATH=/opt/meri-browsers.

# Immutable upstream base: Node LTS 24.21.0 on Debian bookworm slim, linux/amd64.
# Multiarch index digest resolved 2026-10-09 from registry-1.docker.io library/node;
# linux/amd64 manifest sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd.
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

# The upstream slim Node image ships WITHOUT ca-certificates. Debian documents
# source-scoped Check-Valid-Until: no for historical snapshots, and the
# bookworm-security Release of the fixed snapshot is expired by build time. So:
#   1) bootstrap apt over the fixed signed snapshot via HTTP only (no CA needed),
#      installing the exact resolved ca-certificates;
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
      'URIs: http://snapshot.debian.org/archive/debian/20261009T000000Z' \
      'Suites: bookworm' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      '' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian-security/20261009T000000Z' \
      'Suites: bookworm-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      > /etc/apt/sources.list.d/meri-snapshot.sources; \
    apt-get update; \
    apt-get install -y --no-install-recommends --no-remove ca-certificates=20250419~deb12u1; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# Switch both fixed snapshot sources to HTTPS with normal CA verification.
RUN set -eux; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: https://snapshot.debian.org/archive/debian/20261009T000000Z' \
      'Suites: bookworm' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      '' \
      'Types: deb' \
      'URIs: https://snapshot.debian.org/archive/debian-security/20261009T000000Z' \
      'Suites: bookworm-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      > /etc/apt/sources.list.d/meri-snapshot.sources

# Direct OS package pins at the highest appropriate candidates in snapshot
# 20261009T000000Z (see component-pins.json osPackages.resolved). Then refresh
# ALL inherited installed packages with a no-removal bounded upgrade so the base
# cannot stay stale (fail rather than silently removing a needed package).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends --no-remove \
      python3=3.11.2-1+b1 python3-venv=3.11.2-1+b1 \
      libreoffice-core=4:7.4.7-1+deb12u14 libreoffice-writer=4:7.4.7-1+deb12u14 \
      libreoffice-calc=4:7.4.7-1+deb12u14 libreoffice-impress=4:7.4.7-1+deb12u14 \
      fonts-liberation=1:1.07.4-11 fonts-dejavu-core=2.37-6 fonts-noto-core=20201225-1 \
      fonts-crosextra-carlito=20220224-1 fonts-crosextra-caladea=20200211-1 \
      poppler-utils=22.12.0-2+deb12u3 \
      libnss3=2:3.87.1-1+deb12u4 libnspr4=2:4.35-1 libatk1.0-0=2.46.0-5 \
      libatk-bridge2.0-0=2.46.0-5 libcups2=2.4.2-3+deb12u9 libdrm2=2.4.114-1+b1 \
      libxkbcommon0=1.5.0-1 libxcomposite1=1:0.4.5-1 libxdamage1=1:1.1.6-1 \
      libxfixes3=1:6.0.0-2 libxrandr2=2:1.5.2-2+b1 libgbm1=22.3.6-1+deb12u2 \
      libpango-1.0-0=1.50.12+ds-1 libcairo2=1.16.0-7 libasound2=1.2.8-1+b1 \
      libatspi2.0-0=2.46.0-5 libx11-6=2:1.8.4-2+deb12u2 libxcb1=1.15-1 \
      libxext6=2:1.3.4-1+b1 libglib2.0-0=2.74.6-2+deb12u9 libexpat1=2.5.0-1+deb12u4; \
    apt-get -y --no-remove dist-upgrade; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/meri-worker

# Record the exact installed package inventory and runtime versions from the
# real build (safe no-network version commands only).
RUN set -eux; \
    dpkg-query -W -f='${Package}=${Version}\n' | sort > /opt/meri-worker/os-installed-packages.txt; \
    { echo "node $(node --version)"; echo "python3 $(python3 --version 2>&1)"; } > /opt/meri-worker/runtime-versions.txt; \
    (HOME=/tmp soffice --version 2>/dev/null | head -n1 >> /opt/meri-worker/runtime-versions.txt) || echo "libreoffice version unavailable" >> /opt/meri-worker/runtime-versions.txt; \
    cat /opt/meri-worker/runtime-versions.txt

# Node candidate packages: one locked install from the nested lockfile,
# including optional platform binaries (the SDK's linux-x64 CLI). No fallback.
COPY package.json package-lock.json ./
RUN set -eux; npm ci --no-audit --no-fund --include=optional

# Build-time byte verification of the pinned SDK Linux binary against its
# component-pins.json checksum (no binary execution, no model call).
RUN set -eux; \
    sdk_bin="node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude"; \
    test -f "$sdk_bin"; \
    test "$(stat -c '%s' "$sdk_bin")" = 256113848; \
    test "$(sha256sum "$sdk_bin" | cut -d' ' -f1)" = "4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358"; \
    echo "sdk-linux-x64 binary verified: 4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358"

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

# Record the installed CFT chrome/helper hashes. The CFT archive was
# independently inspected on the authoring host (sha256 a24546e0e6c763bf86
# 4861ce50498f38783663e24cd2af2a16798c25dc3a9489) but NO per-file prior hash is
# pinned, so an independent byte comparison is UNAVAILABLE here and recorded as
# such rather than claimed.
RUN set -eux; \
    cb="$(find /opt/meri-browsers -path '*chrome-linux64/chrome' -print -quit)"; \
    sb="$(find /opt/meri-browsers \( -name chrome_sandbox -o -name chrome-sandbox \) -print -quit)"; \
    test -n "$cb"; test -n "$sb"; \
    printf '%s\n' \
      "cft-chrome sha256: $(sha256sum "$cb" | cut -d' ' -f1)" \
      "cft-helper sha256: $(sha256sum "$sb" | cut -d' ' -f1)" \
      "archive-sha256 (independently inspected): a24546e0e6c763bf864861ce50498f38783663e24cd2af2a16798c25dc3a9489" \
      "per-file prior-hash comparison: UNAVAILABLE (no per-file hash pinned)" \
      > /opt/meri-worker/cft-hashes.txt; \
    cat /opt/meri-worker/cft-hashes.txt

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
