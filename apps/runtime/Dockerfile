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
# The pinned PptxGenJS module the fixed presentation generator loads by absolute path
# (artifacts.executor.pptxModulePath = /opt/meri/apps/artifacts/generation/node_modules/pptxgenjs).
COPY apps/artifacts/generation/package.json apps/artifacts/generation/package-lock.json ./apps/artifacts/generation/
RUN npm ci --prefix apps/artifacts/generation --omit=dev --ignore-scripts --no-audit --no-fund
COPY apps ./apps
COPY packages ./packages
COPY infra/product-preview/runtime-packages.lock.json ./infra/product-preview/runtime-packages.lock.json
# Stage 1 one-shot database runner (D2). Its migrations already arrive through `COPY apps`.
COPY infra/product-preview/first-chat-migrate.mjs infra/product-preview/first-chat-database.sql infra/product-preview/first-chat-database-temporal.sql infra/product-preview/first-chat-database-integration.sql infra/product-preview/first-chat-seed-budget.sql ./infra/product-preview/
# Stage the retained public index/APK snapshot through the same exact size/hash
# checks. The upstream index URL rotates; the build never downloads it. Kept
# outside /opt/meri so the snapshot is not copied into the runtime image.
COPY infra/product-preview/runtime-packages/x86_64 /opt/meri-runtime-input/x86_64
RUN --network=none node apps/runtime/build/runtime-packages.mjs fetch --lock infra/product-preview/runtime-packages.lock.json --directory /opt/meri-runtime-packages --from /opt/meri-runtime-input/x86_64
# The retained exact PyPI wheels of the pure-Python generator libraries Wolfi does not
# package (infra/product-preview/runtime-wheels.lock.json); verified and unpacked in the runtime stage.
COPY infra/product-preview/runtime-packages/wheels /opt/meri-runtime-input/wheels
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
# Every package is pinned explicitly: the four runtime additions plus the document
# generation executor's CPython 3.13 interpreter and the Pillow, lxml, typing-extensions
# and matplotlib (numpy/openblas) closure that apps/artifacts/python imports; each row and
# its version is also in runtime-packages.lock.json, which `verify` below compares with the
# installed database. pandas (run_analysis only, not a documents-family operation) is omitted.
RUN --mount=type=bind,from=builder,source=/opt/meri-runtime-packages,target=/tmp/runtime-repo,readonly --network=none \
    printf '%s\n' 'f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc  /etc/apk/keys/wolfi-signing.rsa.pub' | sha256sum -c - && \
    apk --repositories-file /dev/null --keys-dir /etc/apk/keys --repository /tmp/runtime-repo add --no-network --no-cache \
      bash=5.3-r14 libstdc++=16.2.0-r1 ncurses=6.6.20261010-r0 ncurses-terminfo-base=6.6.20261010-r0 \
      python-3.13-base=3.13.16_git20261016-r0 py3-pip-wheel=26.2.1-r4 gdbm=1.26-r7 libbz2-1=1.0.8-r25 libexpat1=2.9.0-r0 libffi=3.8.0-r2 \
      libuuid=2.42.4-r0 mpdecimal=4.0.1-r4 readline=8.3-r3 sqlite-libs=3.54.1-r0 xz=5.8.4-r0 \
      py3.13-pillow=12.3.0-r1 freetype=2.14.3-r7 lcms2=2.19.1-r3 libjpeg-turbo=3.2.0-r5 libpng=1.6.59-r0 libwebp=1.6.0-r7 openjpeg=2.5.4-r3 \
      tiff=4.7.2-r3 libzstd1=1.5.7-r10 libxcb=1.17.0-r17 libxau=1.0.12-r9 libxdmcp=1.1.5-r12 \
      py3.13-lxml=6.1.3-r0 libxml2-16=2.15.4-r1 libxslt=1.1.45-r5 py3.13-typing-extensions=4.16.0-r0 \
      py3.13-matplotlib=3.11.2-r0 py3.13-numpy-2.2=2.2.6-r5 libopenblas-0=0.3.34-r1 libgfortran=16.2.0-r1 py3.13-pygments=2.21.0-r0 \
      py3.13-contourpy=1.4.0-r1 py3.13-cycler=0.12.1-r8 py3.13-fonttools=4.67.0-r0 py3.13-kiwisolver=1.5.1-r1 py3.13-packaging=26.3-r0 \
      py3.13-pyparsing=3.3.3-r0 py3.13-python-dateutil=2.9.0-r13 py3.13-six=1.17.0-r7
# The pure-Python generator libraries Wolfi does not package (python-docx, XlsxWriter,
# openpyxl, et_xmlfile): exact PyPI wheels pinned by infra/product-preview/runtime-wheels.lock.json
# (the same hashes as apps/worker/qualification/requirements.lock.txt), retained under
# infra/product-preview/runtime-packages/wheels and unpacked into the interpreter's own
# site-packages, the only path `python -I` reads. No pip, no network. The import smoke then
# pins every library version the executor runs, the PptxGenJS module loads, and the lock's
# `verify` compares the complete installed package set and required files with the lock.
RUN --mount=type=bind,from=builder,source=/opt/meri-runtime-input/wheels,target=/tmp/runtime-wheels,readonly --network=none \
    cd /tmp/runtime-wheels && set -- * && test "$#" = 4 && printf '%s\n' \
      '7a91720bc756843502c3b7504c77b8fe44217c85c537d85037f0f536151b2caa  et_xmlfile-2.0.0-py3-none-any.whl' \
      '5282c12b107bffeef825f4617dc029afaf41d0ea60823bbb665ef3079dc79de2  openpyxl-3.1.5-py2.py3-none-any.whl' \
      '3fd478f3250fbbbfd3b94fe1e985955737c145627498896a8a6bf81f4baf66c7  python_docx-1.2.0-py3-none-any.whl' \
      '9a5db42bc5dff014806c58a20b9eae7322a134abb6fce3c92c181bfb275ec5b3  xlsxwriter-3.2.9-py3-none-any.whl' | sha256sum -c - && \
    test "$(/usr/bin/python3.13 -I -c 'import sysconfig;print(sysconfig.get_paths()["purelib"])')" = /usr/lib/python3.13/site-packages && \
    for wheel in et_xmlfile-2.0.0-py3-none-any.whl openpyxl-3.1.5-py2.py3-none-any.whl python_docx-1.2.0-py3-none-any.whl xlsxwriter-3.2.9-py3-none-any.whl; do /usr/bin/python3.13 -I -B -m zipfile -e "$wheel" /usr/lib/python3.13/site-packages || exit 2; done && \
    cd / && MPLCONFIGDIR=/tmp/meri-image-smoke HOME=/tmp/meri-image-smoke OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 /usr/bin/python3.13 -I -B -c 'import sys,resource,docx,openpyxl,xlsxwriter,et_xmlfile,lxml,PIL,matplotlib,numpy;assert sys.version_info[:3]==(3,13,16),sys.version;assert (docx.__version__,openpyxl.__version__,xlsxwriter.__version__,et_xmlfile.__version__,lxml.__version__,PIL.__version__,matplotlib.__version__,numpy.__version__)==("1.2.0","3.1.5","3.2.9","2.0.0","6.1.3","12.3.0","3.11.2","2.2.6")' && rm -rf /tmp/meri-image-smoke && \
    node -e 'const p=require("/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs/package.json");if(p.name!=="pptxgenjs"||p.version!=="4.0.1")process.exit(2);require("/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs")' && \
    node /opt/meri/apps/runtime/build/runtime-packages.mjs verify --lock /opt/meri/infra/product-preview/runtime-packages.lock.json
RUN addgroup -g 1000 node && adduser -D -u 1000 -G node -h /home/node node
# Amazon RDS global CA bundle, pinned by apps/runtime/certs/rds-global-bundle.lock.json.
# node-postgres sslmode=verify-full (control, proxy owner, issuer -> Aurora) uses
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
USER node
VOLUME ["/run/meri", "/run/meri-temporal", "/tmp", "/workspace"]
ENTRYPOINT ["node", "apps/runtime/cli.mjs"]
CMD ["--help"]
