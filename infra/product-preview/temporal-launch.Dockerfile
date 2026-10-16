# syntax=docker/dockerfile:1.7
# Source-only recipe. Build context is the repository root. No build/deploy is authorized here.
# NODE24_IMAGE must be a separately reviewed node:24-alpine@sha256:<digest>.
ARG NODE24_IMAGE
FROM --platform=linux/amd64 ${NODE24_IMAGE} AS node-runtime
RUN mkdir -p /node-deps/lib && cp -L /lib/ld-musl-x86_64.so.1 /node-deps/node-loader && \
    cp -L /usr/lib/libstdc++.so.6 /usr/lib/libgcc_s.so.1 /node-deps/lib/

# Exact accepted linux/amd64 Temporal 1.32.1 image manifest.
FROM --platform=linux/amd64 temporalio/server@sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e
ARG NODE24_IMAGE
ARG LAUNCH_SOURCE_COMMIT
USER root
COPY --from=node-runtime /usr/local/bin/node /opt/meri/node
COPY --from=node-runtime /node-deps/node-loader /opt/meri/node-loader
COPY --from=node-runtime /node-deps/lib/ /opt/meri/node-lib/
COPY --chmod=0555 infra/product-preview/temporal-launch.sh /opt/meri/temporal-launch
COPY --chmod=0444 infra/product-preview/temporal-launch-main.mjs /opt/meri/temporal-launch-main.mjs
COPY --chmod=0444 infra/product-preview/temporal-launch-render.mjs /opt/meri/temporal-launch-render.mjs
RUN /opt/meri/node-loader --library-path /opt/meri/node-lib /opt/meri/node -e 'const n=process.env.NODE24_IMAGE,s=process.env.LAUNCH_SOURCE_COMMIT;if(!/^node:24-alpine@sha256:[a-f0-9]{64}$/.test(n)||!(/^[a-f0-9]{40}$/.test(s))||process.versions.node.split(".")[0]!=="24")process.exit(1)'
# The supplied CA is public trust material, but its exact version/hash still needs review.
# BuildKit --secret id=temporal_issuer_ca supplies it without a credential in source/build args.
RUN --mount=type=secret,id=temporal_issuer_ca,required=true \
    /opt/meri/node-loader --library-path /opt/meri/node-lib /opt/meri/node -e 'const fs=require("node:fs");fs.copyFileSync("/run/secrets/temporal_issuer_ca","/opt/meri/issuer-ca.pem");fs.chmodSync("/opt/meri/issuer-ca.pem",0o444)'
RUN mkdir -p /run/temporal /tmp && chown temporal:temporal /run/temporal && chmod 0700 /run/temporal && chmod 01777 /tmp
VOLUME ["/run/temporal", "/tmp"]
ENV MERI_TEMPORAL_IMAGE_SOURCE_COMMIT=${LAUNCH_SOURCE_COMMIT}
ENV NODE_EXTRA_CA_CERTS=/opt/meri/issuer-ca.pem
USER temporal
ENTRYPOINT ["/opt/meri/temporal-launch"]
CMD []
