# Meri W02-08 qualification worker image recipe (CANDIDATE, PREPARATION ONLY).
#
# This is the Debian 13 / trixie refresh candidate prepared in W02-08. It is NOT
# built by this session and has NO assembled image digest. Do not attribute any
# prior digest, scan or admission to it.
#
# Honest reconciliation of prior wording: the earlier W02-01 refreshed
# bookworm recipe was in fact built (integration 8785118 -> image
# sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75, "7327"),
# and its ECR basic scan remains UNRESOLVED at 2 CRITICAL / 13 HIGH (see
# docs/coordination/reports/W02-IMAGE-SECURITY-DISPOSITION-PREP.md). The earlier
# component-pins "NOT YET BUILT" wording was stale historical candidate wording
# and is corrected in this ticket. That 7327 evidence/admission does NOT transfer
# to this candidate, which must be built and rescanned on its own.
#
# Intended build after separate owner build-command migration (fresh context):
#   python3 scripts/qualification/worker_context.py --output <absolute-fresh-output>
#   docker build --pull --platform linux/amd64 \
#     -f <absolute-fresh-output>/context/Dockerfile \
#     -t <ecr>/meri-greenfield/qualification-worker:<sha> \
#     <absolute-fresh-output>/context
#
# Runtime expectation (Codex-owned ECS task definition, NOT here):
#   readOnlyRootFilesystem=true, user 10001:10001, drop ALL capabilities,
#   no privileged mode, no Docker socket, no host networking, no added caps,
#   writable empty volumes at /workspace and /tmp, HOME=/workspace/home,
#   TMPDIR=/tmp, CLAUDE_CONFIG_DIR=/workspace/config,
#   PLAYWRIGHT_BROWSERS_PATH=/opt/meri-browsers.

# Immutable upstream base: Node LTS 24.21.0 on Debian 13 / trixie slim, linux/amd64.
# Multiarch index digest resolved 2026-10-09 from registry-1.docker.io library/node
# (tag 24.21.0-trixie-slim); linux/amd64 platform manifest
# sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63.
FROM node:24.21.0-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66

# The upstream slim Node image ships WITHOUT ca-certificates. Debian documents
# source-scoped Check-Valid-Until: no for historical snapshots. At build time on
# 2026-10-09 the trixie-security snapshot Release Valid-Until (2026-10-15) has
# NOT yet expired; the directive is retained because this fixed snapshot is a
# historical artifact consumed after its validity window. Signature verification
# stays enabled. So:
#   1) bootstrap apt over the fixed signed snapshot via HTTP only (no CA needed),
#      installing the exact resolved ca-certificates;
#   2) switch both fixed sources to HTTPS with normal CA verification for every
#      subsequent download.
# Signed-By keyring verification is retained throughout; no trust bypass, no
# unauthenticated downloads, no TLS bypass, no mutable latest/stable tag.
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; \
    printf '%s\n' \
      'Acquire::http::User-Agent "meri-qualification-snapshot/1";' \
      'Acquire::https::User-Agent "meri-qualification-snapshot/1";' \
      > /etc/apt/apt.conf.d/99meri-snapshot-ua; \
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
    apt-get install -y --no-install-recommends --no-remove ca-certificates=20250419; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# Switch both fixed snapshot sources to HTTPS with normal CA verification.
RUN set -eux; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: https://snapshot.debian.org/archive/debian/20261009T000000Z' \
      'Suites: trixie' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      '' \
      'Types: deb' \
      'URIs: https://snapshot.debian.org/archive/debian-security/20261009T000000Z' \
      'Suites: trixie-security' \
      'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' \
      > /etc/apt/sources.list.d/meri-snapshot.sources

# Direct OS package pins at the highest appropriate candidates in snapshot
# 20261009T000000Z (see component-pins.json osPackages.resolved). Then refresh
# ALL inherited installed packages with a no-removal bounded upgrade so the base
# cannot stay stale (fail rather than silently removing a needed package).
# The t64 transition is reflected in the names (libasound2t64, libatk1.0-0t64,
# libatk-bridge2.0-0t64, libcups2t64, libatspi2.0-0t64, libglib2.0-0t64).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends --no-remove \
      python3=3.13.5-1 python3-venv=3.13.5-1 \
      libreoffice-core=4:25.2.3-2+deb13u8 libreoffice-writer=4:25.2.3-2+deb13u8 \
      libreoffice-calc=4:25.2.3-2+deb13u8 libreoffice-impress=4:25.2.3-2+deb13u8 \
      fonts-liberation=1:2.1.5-3 fonts-dejavu-core=2.37-8 fonts-noto-core=20201225-2 \
      fonts-crosextra-carlito=20230309-2 fonts-crosextra-caladea=20200211-2 \
      poppler-utils=25.03.0-5+deb13u4 \
      libnss3=2:3.110-1+deb13u4 libnspr4=2:4.36-1 libatk1.0-0t64=2.56.2-1+deb13u2 \
      libatk-bridge2.0-0t64=2.56.2-1+deb13u2 libcups2t64=2.4.10-3+deb13u2 \
      libdrm2=2.4.124-2 libxkbcommon0=1.7.0-2 libxcomposite1=1:0.4.6-1 \
      libxdamage1=1:1.1.6-1+b2 libxfixes3=1:6.0.0-2+b4 libxrandr2=2:1.5.4-1+b3 \
      libgbm1=25.0.7-2+deb13u1 libpango-1.0-0=1.56.3-1 libcairo2=1.18.4-1+b1 \
      libasound2t64=1.2.14-1+deb13u1 libatspi2.0-0t64=2.56.2-1+deb13u2 \
      libx11-6=2:1.8.12-1 libxcb1=1.17.0-2+b1 libxext6=2:1.3.4-1+b3 \
      libglib2.0-0t64=2.84.4-3~deb13u5 libexpat1=2.8.3-1~deb13u1 \
      libtiff6=4.7.0-3+deb13u3; \
    apt-get -y --no-remove dist-upgrade; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/meri-worker

# Record the exact installed package inventory and runtime versions from the
# real build. dpkg-query output is written then emitted to real build stdout,
# and the build fails closed if it errors or is empty (no unchecked pipeline
# hides a failing status).
RUN set -eux; \
    dpkg-query -W -f='${Package}=${Version}\n' > /opt/meri-worker/os-installed-packages.txt; \
    sort -o /opt/meri-worker/os-installed-packages.txt /opt/meri-worker/os-installed-packages.txt; \
    test -s /opt/meri-worker/os-installed-packages.txt; \
    echo "=== installed dpkg inventory ($(wc -l < /opt/meri-worker/os-installed-packages.txt) packages) ==="; \
    cat /opt/meri-worker/os-installed-packages.txt

# Capture Node/Python/LibreOffice versions with checked commands (HOME=/tmp for
# a writable LibreOffice profile; no network). Any command failure fails the
# build and no placeholder may count as success; stderr is preserved.
RUN set -eux; \
    node --version > /opt/meri-worker/runtime-versions.txt; \
    python3 --version >> /opt/meri-worker/runtime-versions.txt; \
    HOME=/tmp soffice --version > /tmp/lo.out 2> /opt/meri-worker/libreoffice-version.err; \
    grep -Eq 'LibreOffice [0-9]' /tmp/lo.out || grep -Eq 'LibreOffice [0-9]' /opt/meri-worker/libreoffice-version.err; \
    head -n1 /tmp/lo.out >> /opt/meri-worker/runtime-versions.txt; \
    echo "=== libreoffice stderr ==="; cat /opt/meri-worker/libreoffice-version.err; \
    echo "=== runtime versions ==="; cat /opt/meri-worker/runtime-versions.txt

# Node candidate packages: one locked install from the nested lockfile,
# including optional platform binaries (the SDK's linux-x64 CLI). No fallback.
COPY package.json package-lock.json ./
COPY vendor/capiro-meri-contracts-0.1.0.tgz ./vendor/capiro-meri-contracts-0.1.0.tgz
# The sole local public package must match reviewed bytes BEFORE dependency install.
RUN set -eux; \
    archive="vendor/capiro-meri-contracts-0.1.0.tgz"; \
    test -f "$archive"; test ! -L "$archive"; \
    test "$(stat -c '%s' "$archive")" = 48823; \
    printf '%s  %s\n' '2f15ade9458cbffe960b7cc36c6fb77cb54cc2a0eca4bc7c0f918b77cfacd4ee' "$archive" | sha256sum --check --strict -; \
    npm ci --no-audit --no-fund --include=optional

# Build-time byte verification of the pinned SDK Linux binary against its
# component-pins.json checksum (no binary execution, no model call).
RUN set -eux; \
    sdk_bin="node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude"; \
    test -f "$sdk_bin"; \
    test "$(stat -c '%s' "$sdk_bin")" = 256113848; \
    test "$(sha256sum "$sdk_bin" | cut -d' ' -f1)" = "4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358"; \
    echo "sdk-linux-x64 binary verified: 4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358"

# Python candidate libraries: hash-pinned, isolated venv (avoids PEP 668).
# The venv is CPython 3.13 on trixie; the pip removal path tracks the series.
RUN python3 -m venv /opt/meri-venv
COPY requirements.lock.txt ./
RUN set -eux; \
    /opt/meri-venv/bin/pip install --no-cache-dir --require-hashes -r requirements.lock.txt; \
    rm -rf /opt/meri-venv/lib/python3.13/site-packages/pip /root/.cache
ENV PATH="/opt/meri-venv/bin:${PATH}"

# Selected qualification sources only (scoped COPY, never the whole repository).
COPY sdk-options.mjs ./
COPY probes/ ./probes/
COPY checkpoint/native-session-files.mjs ./checkpoint/native-session-files.mjs
COPY checkpoint/fixture-channel.mjs checkpoint/fixture-channel.test.mjs checkpoint/fixture-transport.mjs checkpoint/fixture-transport.test.mjs ./checkpoint/
COPY checkpoint/resume-admission.mjs checkpoint/resume-admission.test.mjs checkpoint/fixture-sentinel.mjs checkpoint/fixture-sentinel.test.mjs ./checkpoint/
# Generated inputs preserve byte-exact canonical root modules. Four-parent
# imports from /opt/meri-worker/probes resolve to /scripts/sdk-capture.
COPY build-dependencies/sdk-capture/json-records.mjs build-dependencies/sdk-capture/protocol.mjs /scripts/sdk-capture/
# Preserve the private source's repository-relative imports. The
# /packages/node_modules link resolves exact locked libraries installed above.
COPY build-dependencies/contracts/ /packages/contracts/
RUN ln -s /opt/meri-worker/node_modules /packages/node_modules

# Matched Chromium (revision 1247 / Chrome-for-Testing 155.0.8059.12) via the
# adopted Playwright CLI. Debian13 maps to the CFT archive
# builds/cft/155.0.8059.12/linux64/chrome-linux64.zip -> chromium-1247/
# chrome-linux64/{chrome,chrome_sandbox}. The CFT helper is chrome_sandbox
# (underscore). The browser tree STAYS root-owned so the setuid helper keeps its
# intended owner/mode.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/meri-browsers
RUN set -eux; \
    node node_modules/playwright/cli.js install chromium; \
    chmod -R a+rX /opt/meri-browsers; \
    base="/opt/meri-browsers/chromium-1247/chrome-linux64"; \
    orig="$base/chrome_sandbox"; alias="$base/chrome-sandbox"; \
    test -f "$orig"; \
    cp -a "$orig" "$alias"; \
    chmod 4755 "$orig" "$alias"; \
    test "$(sha256sum "$orig" | cut -d' ' -f1)" = "be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314"; \
    test "$(sha256sum "$alias" | cut -d' ' -f1)" = "be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314"

# Byte-verify the installed CFT chrome, the pinned original helper and its
# root-owned adjacent hyphen alias against the exact per-file SHA256s
# independently inspected from the pinned archive. Chromium 155's setuid host
# expects adjacent `chrome-sandbox`; the archive helper is `chrome_sandbox`.
RUN set -eux; \
    base="/opt/meri-browsers/chromium-1247/chrome-linux64"; \
    cb="$base/chrome"; orig="$base/chrome_sandbox"; alias="$base/chrome-sandbox"; \
    test -f "$cb"; test -f "$orig"; test -f "$alias"; \
    test "$(sha256sum "$cb" | cut -d' ' -f1)" = "adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0"; \
    test "$(sha256sum "$orig" | cut -d' ' -f1)" = "be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314"; \
    test "$(sha256sum "$alias" | cut -d' ' -f1)" = "be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314"; \
    printf '%s\n' \
      "cft-archive sha256: a24546e0e6c763bf864861ce50498f38783663e24cd2af2a16798c25dc3a9489 (198335306 bytes; independently inspected)" \
      "cft-chrome sha256: $(sha256sum "$cb" | cut -d' ' -f1) (pin adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0)" \
      "cft-helper-original sha256: $(sha256sum "$orig" | cut -d' ' -f1) (pin be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314)" \
      "cft-helper-alias sha256: $(sha256sum "$alias" | cut -d' ' -f1) (matched to pinned original; hyphen alias for Chromium setuid host)" \
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

# Final assertion: after ALL ownership operations the pinned original helper AND
# its adjacent hyphen alias are still root-owned with mode 4755 and setuid, and
# the browser tree is root-owned.
RUN set -eux; \
    base="/opt/meri-browsers/chromium-1247/chrome-linux64"; \
    orig="$base/chrome_sandbox"; alias="$base/chrome-sandbox"; \
    test -f "$orig"; test -f "$alias"; \
    for sb in "$orig" "$alias"; do \
      test "$(stat -c '%U' "$sb")" = root; \
      test "$(stat -c '%a' "$sb")" = 4755; \
      test -u "$sb"; \
    done; \
    test "$(stat -c '%U' /opt/meri-browsers)" = root

# PRIVILEGE-BIT REDUCTION (owner-authorized; PERMISSION BITS ONLY). Runs after
# ALL install/COPY/chown steps and BEFORE the final inventory. It strips SUID/SGID
# from unintended static REGULAR files via chmod and logs each affected path+mode.
# NO library/utility/package removal and NO package-version change. This is
# visibly separate from CVE disposition: it reduces the SUID/SGID surface and does
# NOT fix package CVEs or waive findings. It checks find/stat/chmod outcomes;
# the final inventory rejects observed filesystem races or forbidden modes.
# These path-based chmod operations do not prove a globally atomic snapshot.
# The two pinned Chrome helpers keep their exact bytes and root:root 4755
# identity (required by the existing qualification contract).
RUN set -eux; \
    helper_sb=/opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox; \
    helper_hyphen=/opt/meri-browsers/chromium-1247/chrome-linux64/chrome-sandbox; \
    : > /opt/meri-worker/suid-sgid-reduced.txt; \
    find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /run \) -prune -o \
      -type f -perm /6000 -print > /tmp/suid-files.list; \
    sort -o /tmp/suid-files.list /tmp/suid-files.list; \
    while IFS= read -r f; do \
      [ -n "$f" ] || continue; \
      if [ "$f" = "$helper_sb" ] || [ "$f" = "$helper_hyphen" ]; then continue; fi; \
      test -f "$f"; test ! -L "$f"; \
      old_mode=$(stat -c '%a' -- "$f"); \
      printf '%s mode=%s\n' "$f" "$old_mode" >> /opt/meri-worker/suid-sgid-reduced.txt; \
      chmod u-s,g-s "$f"; \
      remaining=$(find "$f" -perm /6000 -print); \
      test -z "$remaining"; \
    done < /tmp/suid-files.list; \
    rm -f /tmp/suid-files.list; \
    echo "=== SUID/SGID bits reduced (two Chrome helpers preserved) ==="; \
    cat /opt/meri-worker/suid-sgid-reduced.txt; \
    for sb in "$helper_sb" "$helper_hyphen"; do \
      test "$(stat -c '%U:%G' "$sb")" = root:root; \
      test "$(stat -c '%a' "$sb")" = 4755; \
      test -u "$sb"; \
    done

# END-OF-RECIPE STATIC INVENTORY (W02-08). Runs ONLY in the real linux/amd64
# build, AFTER all installs/COPYs/chowns and after the privilege-bit reduction,
# via the separately reviewed stdlib probe probes/image-inventory.py.
# Its roots/pins/allow-list/output are COMPILED into the probe; the CLI supplies
# only the exact declared absolute roots, the exact two pinned Chrome helper
# allow-suid paths, bounds and the fixed output path. It never follows links into
# /proc /sys /dev, records path/type/mode/owner/size and SHA256, verifies the
# unchanged SDK binary and CfT chrome/helper hashes, and fails closed on any
# unreviewed SUID/SGID entry (including directories), wrong helper identity,
# traversal error, race, truncation or limit overrun. Incomplete coverage is NOT
# treated as absence and a name search does not prove renamed copies absent.
RUN set -eux; \
    python3 /opt/meri-worker/probes/image-inventory.py \
      --root /opt/meri-worker --root /opt/meri-venv --root /opt/meri-browsers \
      --root /usr --root /etc --root /var/lib/dpkg \
      --root /bin --root /sbin --root /lib --root /lib64 \
      --root /root --root /home --root /scripts --root /packages \
      --deadline-ms 120000 --max-entries 300000 --max-events 2000000 \
      --max-manifest-bytes 33554432 --max-hash-bytes 536870912 \
      --allow-suid /opt/meri-browsers/chromium-1247/chrome-linux64/chrome_sandbox \
      --allow-suid /opt/meri-browsers/chromium-1247/chrome-linux64/chrome-sandbox \
      --out /opt/meri-worker/image-inventory.json; \
    echo "=== image inventory summary ==="; \
    python3 -c "import json;d=json.load(open('/opt/meri-worker/image-inventory.json'));print(json.dumps(d['summary'],sort_keys=True))"

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
