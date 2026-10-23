# Native ARM64 child manifests, checked against temporal-image-pins.json.
# Build context is the repository root or its exact sealed Temporal subset.
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node@sha256:401346cb1fc12bb388a82ed58ea72eeed2fe8530804d2964bcddce63a4eda4d8 AS node-binary
FROM --platform=linux/arm64 temporalio/server@sha256:2bc795fc7e740235f9afcbfcff7049a55c5a3f0d87b6512d82687a485467795b AS temporal-server
FROM --platform=linux/arm64 cgr.dev/chainguard/wolfi-base@sha256:4e354e15b41a49dc249d07a4e38974c4ef6db8a4cc70059c4d625f5cdaa92657
ARG LAUNCH_SOURCE_COMMIT
USER root
# apk owns the GNU runtime dependencies; no copied loader or private APK repository.
RUN test "$(uname -m)" = aarch64 && apk add --no-cache libatomic=16.2.0-r1 libstdc++=16.2.0-r1
COPY --from=node-binary /usr/local/bin/node /opt/meri/node
# The pinned server is a static AArch64 ELF. The server donor has no schema or SQL tool.
COPY --from=temporal-server /usr/local/bin/temporal-server /usr/local/bin/temporal-server
COPY --chmod=0555 infra/product-preview/temporal-launch.sh /opt/meri/temporal-launch
COPY --chmod=0444 infra/product-preview/temporal-launch-main.mjs /opt/meri/temporal-launch-main.mjs
COPY --chmod=0444 infra/product-preview/temporal-launch-render.mjs /opt/meri/temporal-launch-render.mjs
COPY --chmod=0444 infra/product-preview/temporal-migration-plan.mjs /opt/meri/temporal-migration-plan.mjs
COPY --chmod=0444 infra/product-preview/temporal-image-pins.json /opt/meri/temporal-image-pins.json
RUN /opt/meri/node -e 'const s=process.env.LAUNCH_SOURCE_COMMIT;if(!/^[a-f0-9]{40}$/.test(s)||process.version!=="v24.22.1"||process.arch!=="arm64")process.exit(1)'
# Public trust material only; no CA or credential build argument.
RUN --mount=type=secret,id=temporal_issuer_ca,required=true \
    /opt/meri/node -e 'const fs=require("node:fs"),{X509Certificate}=require("node:crypto");const t=fs.readFileSync("/run/secrets/temporal_issuer_ca","utf8");if(t.length>32768||new X509Certificate(t).ca!==true)process.exit(1);fs.copyFileSync("/run/secrets/temporal_issuer_ca","/opt/meri/issuer-ca.pem",fs.constants.COPYFILE_EXCL);fs.chmodSync("/opt/meri/issuer-ca.pem",0o444)'
RUN addgroup -g 1000 temporal && adduser -D -u 1000 -G temporal -h /etc/temporal -s /bin/sh temporal && \
    mkdir -p /run/temporal /tmp && chown temporal:temporal /run/temporal && chmod 0700 /run/temporal && chmod 01777 /tmp
WORKDIR /etc/temporal
VOLUME ["/run/temporal", "/tmp"]
ENV MERI_TEMPORAL_IMAGE_SOURCE_COMMIT=${LAUNCH_SOURCE_COMMIT}
ENV NODE_EXTRA_CA_CERTS=/opt/meri/issuer-ca.pem
ENV HOME=/etc/temporal
USER 1000:1000
ENTRYPOINT ["/opt/meri/temporal-launch"]
CMD []
