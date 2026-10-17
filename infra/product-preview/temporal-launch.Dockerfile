# Source-only recipe. Build context is the repository root (or the exact subset that
# temporal-image-build.sh assembles). No build/deploy is authorized by this file.
# Every base is a literal linux/amd64 platform-manifest digest; there is no base-image
# build argument to substitute. No `# syntax=` line: that would pull an unpinned
# frontend image, and BuildKit's built-in frontend supports every instruction below.

# Node 24.21.0 binary provenance: the same official image the Meri Node runtime uses
# (image-build-source.py / qualify-start.sh nodeImageUri). This image is Debian
# trixie (glibc 2.41); its OS libraries are deliberately NOT copied (Debian glibc
# carries HIGH findings with no stable fix; see RUNTIME-BASE-REMEDIATION-20261017.md).
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63 AS node-binary

# GNU loader/libraries for that binary come from the same pinned Wolfi base and
# retained, signature-authenticated APK snapshot as the qualified Node runtime image
# (glibc-2.44 2.44-r8, libgcc 16.2.0-r1, libstdc++ 16.2.0-r1). Offline, exact pins.
FROM --platform=linux/amd64 cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4 AS node-runtime
COPY --from=node-binary /usr/local/bin/node /usr/local/bin/node
RUN --mount=type=bind,source=infra/product-preview/runtime-packages,target=/tmp/runtime-repo,readonly --network=none \
    printf '%s\n' \
      'f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc  /etc/apk/keys/wolfi-signing.rsa.pub' \
      '01398efd4ae98d03bf5cb2c9c5fe397399bca61b81c8cb0cb36bd90e230137c6  /tmp/runtime-repo/x86_64/APKINDEX.tar.gz' \
      'fc233c091aa551d6ba6da3e444d99a94e9947d53814d20183a0a7ded9a668f80  /tmp/runtime-repo/x86_64/libstdc++-16.2.0-r1.apk' \
      | sha256sum -c - && \
    apk --repositories-file /dev/null --keys-dir /etc/apk/keys --repository /tmp/runtime-repo add --no-network --no-cache libstdc++=16.2.0-r1 && \
    awk -F: '$1=="P"{p=$2} $1=="V"{print p"="$2}' /lib/apk/db/installed | sort > /tmp/installed && \
    for pin in glibc-2.44=2.44-r8 ld-linux-2.44=2.44-r8 libgcc=16.2.0-r1 libstdc++=16.2.0-r1; do grep -qx "$pin" /tmp/installed || exit 1; done && \
    mkdir -p /node-deps/lib && cp -L /lib64/ld-linux-x86-64.so.2 /node-deps/node-loader && \
    /lib64/ld-linux-x86-64.so.2 --list /usr/local/bin/node > /tmp/node-needed && \
    ! grep -q 'not found' /tmp/node-needed && \
    awk '$2=="=>"{print $3}' /tmp/node-needed > /tmp/node-libs && test -s /tmp/node-libs && \
    ! grep -q glibc-hwcaps /tmp/node-libs && \
    while read -r lib; do cp -L "$lib" /node-deps/lib/ || exit 1; done < /tmp/node-libs && \
    /node-deps/node-loader --library-path /node-deps/lib /usr/local/bin/node -e 'if(process.version!=="v24.21.0")process.exit(1)'

# Exact accepted linux/amd64 Temporal 1.32.1 image manifest (Alpine/musl, Go server).
FROM --platform=linux/amd64 temporalio/server@sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e
ARG LAUNCH_SOURCE_COMMIT
USER root
COPY --from=node-runtime /usr/local/bin/node /opt/meri/node
COPY --from=node-runtime /node-deps/node-loader /opt/meri/node-loader
COPY --from=node-runtime /node-deps/lib/ /opt/meri/node-lib/
COPY --chmod=0555 infra/product-preview/temporal-launch.sh /opt/meri/temporal-launch
COPY --chmod=0444 infra/product-preview/temporal-launch-main.mjs /opt/meri/temporal-launch-main.mjs
COPY --chmod=0444 infra/product-preview/temporal-launch-render.mjs /opt/meri/temporal-launch-render.mjs
COPY --chmod=0444 infra/product-preview/temporal-migration-plan.mjs /opt/meri/temporal-migration-plan.mjs
# The GNU loader runs the GNU Node binary with only its own library set on this musl
# base; nothing is installed into the Alpine package database.
RUN /opt/meri/node-loader --library-path /opt/meri/node-lib /opt/meri/node -e 'const s=process.env.LAUNCH_SOURCE_COMMIT;if(!/^[a-f0-9]{40}$/.test(s)||process.version!=="v24.21.0")process.exit(1)'
# The issuer CA is public trust material bound by SHA-256 in the sealed context and
# receipt. BuildKit --secret id=temporal_issuer_ca supplies it without a build argument.
RUN --mount=type=secret,id=temporal_issuer_ca,required=true \
    /opt/meri/node-loader --library-path /opt/meri/node-lib /opt/meri/node -e 'const fs=require("node:fs"),{X509Certificate}=require("node:crypto");const t=fs.readFileSync("/run/secrets/temporal_issuer_ca","utf8");if(t.length>32768||new X509Certificate(t).ca!==true)process.exit(1);fs.copyFileSync("/run/secrets/temporal_issuer_ca","/opt/meri/issuer-ca.pem",fs.constants.COPYFILE_EXCL);fs.chmodSync("/opt/meri/issuer-ca.pem",0o444)'
RUN mkdir -p /run/temporal /tmp && chown temporal:temporal /run/temporal && chmod 0700 /run/temporal && chmod 01777 /tmp
VOLUME ["/run/temporal", "/tmp"]
ENV MERI_TEMPORAL_IMAGE_SOURCE_COMMIT=${LAUNCH_SOURCE_COMMIT}
ENV NODE_EXTRA_CA_CERTS=/opt/meri/issuer-ca.pem
USER temporal
ENTRYPOINT ["/opt/meri/temporal-launch"]
CMD []
