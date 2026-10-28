# Native ARM64 child manifests; source provenance is in runtime-packages.lock.json.
ARG NODE_IMAGE=public.ecr.aws/docker/library/node@sha256:401346cb1fc12bb388a82ed58ea72eeed2fe8530804d2964bcddce63a4eda4d8
ARG RUNTIME_IMAGE=cgr.dev/chainguard/wolfi-base@sha256:4e354e15b41a49dc249d07a4e38974c4ef6db8a4cc70059c4d625f5cdaa92657
FROM ${NODE_IMAGE} AS builder
RUN test "$(uname -m)" = aarch64 && test "$(node --version)" = v24.22.1
WORKDIR /opt/meri
# Retain upstream npm/npx; replace only its vulnerable bundled undici package.
COPY apps/runtime/build/npm-bundle.mjs ./apps/runtime/build/
COPY infra/product-preview/runtime-packages.lock.json ./infra/product-preview/
ADD --checksum=sha256:228bd64aaef23270dbdbd2cf3d5ef5c467602ef38c4066246cef1984adab9a67 https://registry.npmjs.org/npm/-/npm-12.2.1.tgz /tmp/npm.tgz
ADD --checksum=sha256:29c4b8e0b2d86cb8795571c1959012ce057a14ecfd34858335f47c31e770a04f https://registry.npmjs.org/undici/-/undici-6.29.1.tgz /tmp/undici.tgz
RUN mkdir /tmp/npm-upstream /tmp/undici-upstream && \
    tar -xzf /tmp/npm.tgz -C /tmp/npm-upstream --strip-components=1 && \
    tar -xzf /tmp/undici.tgz -C /tmp/undici-upstream --strip-components=1 && \
    rm -rf /usr/local/lib/node_modules/npm && \
    cp -a /tmp/npm-upstream /usr/local/lib/node_modules/npm && \
    ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    cp -a /tmp/undici-upstream /usr/local/lib/node_modules/npm/node_modules/undici && \
    node apps/runtime/build/npm-bundle.mjs /tmp/npm-upstream /usr/local/lib/node_modules/npm /tmp/undici-upstream && \
    test "$(npm --version)" = 12.2.1 && test "$(npx --version)" = 12.2.1 && \
    rm -rf /tmp/npm.tgz /tmp/undici.tgz /tmp/npm-upstream /tmp/undici-upstream
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
COPY infra/product-preview/first-chat-migrate.mjs infra/product-preview/first-chat-database.sql infra/product-preview/first-chat-database-temporal.sql infra/product-preview/first-chat-database-integration.sql infra/product-preview/first-chat-database-owner-reads.sql infra/product-preview/first-chat-seed-budget.sql infra/product-preview/first-chat-native-retention-grants.sql infra/product-preview/first-chat-expired-conversation-purge-grants.sql infra/product-preview/first-chat-schedule-worker-grants.sql ./infra/product-preview/
# SWC's upstream carrier extracts a native payload. Bake it while writable so
# the final UID1000 process needs no executable cache on its read-only root.
RUN --network=none node apps/runtime/build/materialize-swc.mjs
RUN mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk && ln -s ../../packages/contracts node_modules/@capiro/meri-contracts && ln -s ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk && ln -s ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3
# Retention workflows share the conversation workflow's pinned Temporal package.
RUN ln -s ../conversations/node_modules apps/control/retention/node_modules

# Layer/stage organization only. Docker's layer store refuses a chain deeper than its depth limit
# ("max depth exceeded"), and the first real ARM build of this composition died exactly there:
# build 1609f5c6 [runtime 120/208] ADD libseccomp ... "failed to prepare ...: max depth exceeded"
# after ~120 chained apk layers. The 190 pinned archives therefore stay the same per-archive
# ADD --checksum instructions, byte for byte and in their original order (same URLs, same checksums),
# but they are staged in four repository stages whose chains each stay under 64 layers; the runtime
# stage takes the assembled local repository in one COPY --from layer per staging stage. Pinned URLs
# and checksums, the retained vendor-signed index and the offline install are unchanged.
FROM ${RUNTIME_IMAGE} AS native-repo-1
ADD --checksum=sha256:d2a458ae71b3f6f65302a8dd61c35f75f3eef87aeb5583a3f97523e99698cf49 https://packages.wolfi.dev/os/aarch64/ca-certificates-bundle-20261020-r0.apk /tmp/meri-native-repo/aarch64/ca-certificates-bundle-20261020-r0.apk
ADD --checksum=sha256:e101b8329bc777d7de8a03d755d9b31e409f500b3717d16d6d5f6b807c94a4fa https://packages.wolfi.dev/os/aarch64/cairo-1.18.6-r1.apk /tmp/meri-native-repo/aarch64/cairo-1.18.6-r1.apk
ADD --checksum=sha256:13f74b6fb67cf686f49b122b81c62a42bebf8ab57b77c7ca6ae1e907ad36e603 https://packages.wolfi.dev/os/aarch64/clamav-1.5-1.5.2-r7.apk /tmp/meri-native-repo/aarch64/clamav-1.5-1.5.2-r7.apk
ADD --checksum=sha256:5bf4b9680aad20835becb9198c7a5fa05f4716380a83ca1f6f5664c53cb09672 https://packages.wolfi.dev/os/aarch64/clamav-1.5-clamdscan-1.5.2-r7.apk /tmp/meri-native-repo/aarch64/clamav-1.5-clamdscan-1.5.2-r7.apk
ADD --checksum=sha256:91d2320bbb83ecf1fe6e25ca9ce3847fb04c5782e6bcce60641ead6b2e03017e https://packages.wolfi.dev/os/aarch64/clamav-1.5-daemon-1.5.2-r7.apk /tmp/meri-native-repo/aarch64/clamav-1.5-daemon-1.5.2-r7.apk
ADD --checksum=sha256:691a7d174f0a79d26a650804b367cb9c0ca47c1b3a240d5f4c053ff42d7192cf https://packages.wolfi.dev/os/aarch64/clamav-1.5-db-1.5.2-r7.apk /tmp/meri-native-repo/aarch64/clamav-1.5-db-1.5.2-r7.apk
ADD --checksum=sha256:e1d758096a91873113cae77eebc88975cc98584e511f3bfe4e086a91f1de94ac https://packages.wolfi.dev/os/aarch64/clamav-1.5-libunrar-1.5.2-r7.apk /tmp/meri-native-repo/aarch64/clamav-1.5-libunrar-1.5.2-r7.apk
ADD --checksum=sha256:a608dda49365477ed9462b2293ece2facde211a94e5c681dfab20ef97d5b8283 https://packages.wolfi.dev/os/aarch64/clamav-1.5-milter-1.5.2-r7.apk /tmp/meri-native-repo/aarch64/clamav-1.5-milter-1.5.2-r7.apk
ADD --checksum=sha256:4d953f1db918d026e9a84fd630609668f8617cdbcf1a316f459bea9281f911ed https://packages.wolfi.dev/os/aarch64/cyrus-sasl-heimdal-libs-2.1.28-r58.apk /tmp/meri-native-repo/aarch64/cyrus-sasl-heimdal-libs-2.1.28-r58.apk
ADD --checksum=sha256:be4637131721a25ae804af342ee6aa26690eb5ef6fbe62e850fdf1cb1917737a https://packages.wolfi.dev/os/aarch64/fontconfig-config-2.18.3-r4.apk /tmp/meri-native-repo/aarch64/fontconfig-config-2.18.3-r4.apk
ADD --checksum=sha256:6a1c8ee704ddabfce02d9de61162337295c96ed929c68254206878790115c492 https://packages.wolfi.dev/os/aarch64/freetype-2.14.3-r7.apk /tmp/meri-native-repo/aarch64/freetype-2.14.3-r7.apk
ADD --checksum=sha256:5a65bb06ae2fc40c4fa63e0da59928bafba6386bd1af5656e44c1b0fc7e1c7fc https://packages.wolfi.dev/os/aarch64/fribidi-1.0.17-r2.apk /tmp/meri-native-repo/aarch64/fribidi-1.0.17-r2.apk
ADD --checksum=sha256:7c809eeb4a0a2a7ecbbbe92a70abecfccfc5c17ea40144798e8b389dc25ac7e8 https://packages.wolfi.dev/os/aarch64/gdbm-1.26-r9.apk /tmp/meri-native-repo/aarch64/gdbm-1.26-r9.apk
ADD --checksum=sha256:ca2161775cf38fd0d951131502a6edd3ae15cc802c1a90fe6f4133fbba5d7164 https://packages.wolfi.dev/os/aarch64/giflib-6.1.3-r4.apk /tmp/meri-native-repo/aarch64/giflib-6.1.3-r4.apk
ADD --checksum=sha256:f9877cd621c1941636c7e99972fdb3d1bd66fa1fc0a736a9a4d3c7a521a7a14b https://packages.wolfi.dev/os/aarch64/glib-2.90.1-r0.apk /tmp/meri-native-repo/aarch64/glib-2.90.1-r0.apk
ADD --checksum=sha256:5ec2e2a087ca0f82e8c66fee61ff47637d2d65232b2843aaa58d560ec4596907 https://packages.wolfi.dev/os/aarch64/glibc-2.44-2.44-r10.apk /tmp/meri-native-repo/aarch64/glibc-2.44-2.44-r10.apk
ADD --checksum=sha256:2b4056feb07b9abd06d58a7c1031967c5b2d4cefe128e986170dbc1deb338fa4 https://packages.wolfi.dev/os/aarch64/glibc-2.44-locale-posix-2.44-r10.apk /tmp/meri-native-repo/aarch64/glibc-2.44-locale-posix-2.44-r10.apk
ADD --checksum=sha256:f5d946497eb9b022ae41ccf8f14a8662e27ddba20b2b4e4e0b445f2f29a1c258 https://packages.wolfi.dev/os/aarch64/graphite2-1.3.15-r6.apk /tmp/meri-native-repo/aarch64/graphite2-1.3.15-r6.apk
ADD --checksum=sha256:c29197aef40caac4c479df35ddaba01177661c5a7a4dd27442ba7d43f7c4252e https://packages.wolfi.dev/os/aarch64/harfbuzz-15.0.0-r2.apk /tmp/meri-native-repo/aarch64/harfbuzz-15.0.0-r2.apk
ADD --checksum=sha256:e2292206c78ed1aac2047d4be70cd3ab5992efcbba5065f1d9ceeff07c1ec437 https://packages.wolfi.dev/os/aarch64/heimdal-libs-7.8.0-r54.apk /tmp/meri-native-repo/aarch64/heimdal-libs-7.8.0-r54.apk
ADD --checksum=sha256:d055a6b9db1a07839c7984fc4ff6332ed349384dbfc9f87aa2d839f44603c049 https://packages.wolfi.dev/os/aarch64/icu-data-full-75.1-r42.apk /tmp/meri-native-repo/aarch64/icu-data-full-75.1-r42.apk
ADD --checksum=sha256:930fdb992a4b2dcdf4eded827f635902eb2eaa78f9d3af283db336fc10009db8 https://packages.wolfi.dev/os/aarch64/icu-libs-75.1-r42.apk /tmp/meri-native-repo/aarch64/icu-libs-75.1-r42.apk
ADD --checksum=sha256:ed8464ea37ad9d4f008c17864a5b97bbe1b41969c79b4c9913921eb965db267e https://packages.wolfi.dev/os/aarch64/json-c-0.19-r2.apk /tmp/meri-native-repo/aarch64/json-c-0.19-r2.apk
ADD --checksum=sha256:fc8f8f28e6472244ebad031f585fcb86a0b870c4f4e5f1415943b76afbf3e4b0 https://packages.wolfi.dev/os/aarch64/keyutils-libs-1.6.3-r41.apk /tmp/meri-native-repo/aarch64/keyutils-libs-1.6.3-r41.apk
ADD --checksum=sha256:6a933ca1514f76081d839361a01313cae7c5381a5a9e8130ef38cb75d00b20f0 https://packages.wolfi.dev/os/aarch64/krb5-conf-1.0-r10.apk /tmp/meri-native-repo/aarch64/krb5-conf-1.0-r10.apk
ADD --checksum=sha256:bde3fb18cc946f07cde48c022c690650ba8476f27fa973a1cbaa7a4deea36c39 https://packages.wolfi.dev/os/aarch64/krb5-libs-1.22.2-r5.apk /tmp/meri-native-repo/aarch64/krb5-libs-1.22.2-r5.apk
ADD --checksum=sha256:f5ab17da389f6a79a51be7717c222239f0c6119ffd73b7b917ee0badaf153fe3 https://packages.wolfi.dev/os/aarch64/lcms2-2.19.1-r5.apk /tmp/meri-native-repo/aarch64/lcms2-2.19.1-r5.apk
ADD --checksum=sha256:f69972a7647987c61a1a29bc7c1854458bd351fb7a191c7f51e27a683769dad0 https://packages.wolfi.dev/os/aarch64/ld-linux-2.44-2.44-r10.apk /tmp/meri-native-repo/aarch64/ld-linux-2.44-2.44-r10.apk
ADD --checksum=sha256:4ab67d18cbdb44c3b37c543b6e735583ef757696e4d11dedc88c20c165a4ee8f https://packages.wolfi.dev/os/aarch64/libacl1-2.4.0-r4.apk /tmp/meri-native-repo/aarch64/libacl1-2.4.0-r4.apk
ADD --checksum=sha256:72ec9ba6472af3213a09b9674b7bba7ea2aa1ecdf0dee09e4a24a9108db5598f https://packages.wolfi.dev/os/aarch64/libarchive-3.8.10-r0.apk /tmp/meri-native-repo/aarch64/libarchive-3.8.10-r0.apk
ADD --checksum=sha256:7f732012769f0eaa784c68484d7b1b0bb4bad9000b1837c28719b5cb82377077 https://packages.wolfi.dev/os/aarch64/libblkid-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/libblkid-2.42.4-r1.apk
ADD --checksum=sha256:5a71e1e2255f6e85cf501b60a34584e097fe743a91bf0e60338376ddc5a24090 https://packages.wolfi.dev/os/aarch64/libbrotlicommon1-1.2.1-r2.apk /tmp/meri-native-repo/aarch64/libbrotlicommon1-1.2.1-r2.apk
ADD --checksum=sha256:29b9fcc4d55fea32dbe590a2e3de0459109c8103b6dc568e650e0e6395280a82 https://packages.wolfi.dev/os/aarch64/libbrotlidec1-1.2.1-r2.apk /tmp/meri-native-repo/aarch64/libbrotlidec1-1.2.1-r2.apk
ADD --checksum=sha256:14ba019e5e959d8f4ae06f6a6c9e1014842b730d2a10a2fbb66fb780523910f7 https://packages.wolfi.dev/os/aarch64/libbrotlienc1-1.2.1-r2.apk /tmp/meri-native-repo/aarch64/libbrotlienc1-1.2.1-r2.apk
ADD --checksum=sha256:46ce3328e2372eadeb71ef1dc179e2427cefa2264bc0e90e8749e4fee7d644f9 https://packages.wolfi.dev/os/aarch64/libbz2-1-1.0.8-r28.apk /tmp/meri-native-repo/aarch64/libbz2-1-1.0.8-r28.apk
ADD --checksum=sha256:e7e46a09271baccf16553997096d72a9059437a527f10331a12fc6a2f18c5d45 https://packages.wolfi.dev/os/aarch64/libcom_err-1.47.4-r5.apk /tmp/meri-native-repo/aarch64/libcom_err-1.47.4-r5.apk
ADD --checksum=sha256:40c7bfd615a69e8747d3a5d0ca9a37dc2a8b169bcd4c2df4b387922d9fe5b553 https://packages.wolfi.dev/os/aarch64/libcrypt1-2.44-2.44-r10.apk /tmp/meri-native-repo/aarch64/libcrypt1-2.44-2.44-r10.apk
ADD --checksum=sha256:1cd0edb0d40aaeb5281566f4c4d17583447b77b74e1bc3281de642e8e9493bf1 https://packages.wolfi.dev/os/aarch64/libcurl-openssl4-8.23.0-r2.apk /tmp/meri-native-repo/aarch64/libcurl-openssl4-8.23.0-r2.apk
ADD --checksum=sha256:abeeb0ffa21b3ca6175cb997d9919920a26a2f50aaa61116f03ed40b1cfd764f https://packages.wolfi.dev/os/aarch64/libexpat1-2.9.0-r0.apk /tmp/meri-native-repo/aarch64/libexpat1-2.9.0-r0.apk
ADD --checksum=sha256:df5cab585fd544ce671305dc8b8187bb1ed0c8ac016e995dd129d8d6dd9c556b https://packages.wolfi.dev/os/aarch64/libffi-3.8.0-r2.apk /tmp/meri-native-repo/aarch64/libffi-3.8.0-r2.apk
ADD --checksum=sha256:8398cda32dab892a680226feacac1165ab080df1102fc2972f3795af25bda8dc https://packages.wolfi.dev/os/aarch64/libfontconfig1-2.18.3-r4.apk /tmp/meri-native-repo/aarch64/libfontconfig1-2.18.3-r4.apk
ADD --checksum=sha256:c782296bb6afa9c6e183ef51bc14367e55768ba2acdbc822fccc96ac82257220 https://packages.wolfi.dev/os/aarch64/libgcc-16.2.0-r2.apk /tmp/meri-native-repo/aarch64/libgcc-16.2.0-r2.apk
ADD --checksum=sha256:c9489c1f009a75967b198bf30415637505ad85ec7d7afca74ee3e76c84335bd7 https://packages.wolfi.dev/os/aarch64/libidn2-2.3.8-r12.apk /tmp/meri-native-repo/aarch64/libidn2-2.3.8-r12.apk
ADD --checksum=sha256:b9c466e9e914bedb20eb9c8de21046d4db71efbf9a4eb2695d612614d99a3dbe https://packages.wolfi.dev/os/aarch64/libjpeg-turbo-3.2.1-r0.apk /tmp/meri-native-repo/aarch64/libjpeg-turbo-3.2.1-r0.apk
ADD --checksum=sha256:e5f31e389061015223f51503186e8f774c767175596769e91f30166a08e9a73f https://packages.wolfi.dev/os/aarch64/libldap-2.7-2.7.2-r0.apk /tmp/meri-native-repo/aarch64/libldap-2.7-2.7.2-r0.apk
ADD --checksum=sha256:6ae70433df5da1339a1d76e34a1ed1a715f81b0cafa242674972cbfef9b7d709 https://packages.wolfi.dev/os/aarch64/liblz4-1-1.10.0-r11.apk /tmp/meri-native-repo/aarch64/liblz4-1-1.10.0-r11.apk
ADD --checksum=sha256:96419166eb4979516abcd40cd1bfce94b8f20a41c7ab7712492a0861e0aeff3a https://packages.wolfi.dev/os/aarch64/libmount-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/libmount-2.42.4-r1.apk
ADD --checksum=sha256:b83772af732a2eea366c2229209b60cd1046b461f3a28b9652c5cc0ba38fd82b https://packages.wolfi.dev/os/aarch64/libmspack-1.11-r0.apk /tmp/meri-native-repo/aarch64/libmspack-1.11-r0.apk
FROM ${RUNTIME_IMAGE} AS native-repo-2
ADD --checksum=sha256:e210213dea283409610f842a816cde531a8e9990d437897b11cc01292c52929b https://packages.wolfi.dev/os/aarch64/libnghttp2-14-1.70.0-r7.apk /tmp/meri-native-repo/aarch64/libnghttp2-14-1.70.0-r7.apk
ADD --checksum=sha256:27d2e35ce2aaec77b75095e66cb1fe5044126af66fc6bdc87a03cf5f8a5ab21d https://packages.wolfi.dev/os/aarch64/libnspr-4.40-r2.apk /tmp/meri-native-repo/aarch64/libnspr-4.40-r2.apk
ADD --checksum=sha256:c4579616a2056cd55cb50cd3d9041b6580aa44de09959efe17bcc7f6c7bf1156 https://packages.wolfi.dev/os/aarch64/libnss-3.132-r0.apk /tmp/meri-native-repo/aarch64/libnss-3.132-r0.apk
ADD --checksum=sha256:951a1e197e06d20d19bfeaa71629cf5acc4f62174ae2802d071cb230b72b3d9b https://packages.wolfi.dev/os/aarch64/libpcre2-8-0-10.49-r1.apk /tmp/meri-native-repo/aarch64/libpcre2-8-0-10.49-r1.apk
ADD --checksum=sha256:8f22ebe44d23d07a60b79462677e3b1e9fedab81e8be8cd5f1d04a5cf40c7b61 https://packages.wolfi.dev/os/aarch64/libpng-1.6.59-r0.apk /tmp/meri-native-repo/aarch64/libpng-1.6.59-r0.apk
ADD --checksum=sha256:eeac8fadc4a543c649d8162107f771d4ed71842585d90835ed100fd2b79ef77e https://packages.wolfi.dev/os/aarch64/libpsl-0.23.3-r4.apk /tmp/meri-native-repo/aarch64/libpsl-0.23.3-r4.apk
ADD --checksum=sha256:6c96ee48b1ed094dd58598f3df0b2ae678a78d343b3d6f6cf25e6a59a685eea9 https://packages.wolfi.dev/os/aarch64/libselinux-3.11-r2.apk /tmp/meri-native-repo/aarch64/libselinux-3.11-r2.apk
ADD --checksum=sha256:d44df089fbd2260bba1ecc62e6cff0fa7f22382a86718fdb3f79e0f9086a92ae https://packages.wolfi.dev/os/aarch64/libsepol-3.11-r3.apk /tmp/meri-native-repo/aarch64/libsepol-3.11-r3.apk
ADD --checksum=sha256:a004dfb5d3a07f49e3e281947f64b434a4ee683c6c597ef191bb39f749eadacc https://packages.wolfi.dev/os/aarch64/libstdc++-16.2.0-r2.apk /tmp/meri-native-repo/aarch64/libstdc++-16.2.0-r2.apk
ADD --checksum=sha256:540cec75eefb0f6f384701b5995f48c27f13744940a477ed23d9e119b9faa6e8 https://packages.wolfi.dev/os/aarch64/libunistring-1.5-r0.apk /tmp/meri-native-repo/aarch64/libunistring-1.5-r0.apk
ADD --checksum=sha256:864750d72131a29f2f383e53adad5a3e4d32f70ffb3aef6282c0276ccfa8693d https://packages.wolfi.dev/os/aarch64/libverto-0.3.2-r11.apk /tmp/meri-native-repo/aarch64/libverto-0.3.2-r11.apk
ADD --checksum=sha256:f431ef5b6d972ea03d16d4559e7a4b7b5bae7f7bfbd4ecc10d7c3bfa15def764 https://packages.wolfi.dev/os/aarch64/libwebp-1.6.0-r7.apk /tmp/meri-native-repo/aarch64/libwebp-1.6.0-r7.apk
ADD --checksum=sha256:890008fdbe3adec8250e9c65d395722726408bcfb547e22bdae4883495c6a39d https://packages.wolfi.dev/os/aarch64/libx11-1.8.14-r3.apk /tmp/meri-native-repo/aarch64/libx11-1.8.14-r3.apk
ADD --checksum=sha256:84cb602ad9ca286eeff476d10839daf71770626f2cd88a27c422fd14b5522a5c https://packages.wolfi.dev/os/aarch64/libxau-1.0.12-r11.apk /tmp/meri-native-repo/aarch64/libxau-1.0.12-r11.apk
ADD --checksum=sha256:7348db0c22354d4da06d1c9d685c5deed50945dc03a7cb4a365a7c151fc162f0 https://packages.wolfi.dev/os/aarch64/libxcb-1.17.0-r19.apk /tmp/meri-native-repo/aarch64/libxcb-1.17.0-r19.apk
ADD --checksum=sha256:9dfd2b4a72d35a1f2c146a968c2368d7cab51bc7ae7854e3dc61e8a98dfeb746 https://packages.wolfi.dev/os/aarch64/libxcrypt-4.5.2-r6.apk /tmp/meri-native-repo/aarch64/libxcrypt-4.5.2-r6.apk
ADD --checksum=sha256:82fc03408c016403bc203ee75f70ff371ba332951fd4cda0575a91cfe85a0794 https://packages.wolfi.dev/os/aarch64/libxdmcp-1.1.5-r14.apk /tmp/meri-native-repo/aarch64/libxdmcp-1.1.5-r14.apk
ADD --checksum=sha256:d048d0157ec5046a97aef646e11d54dcc2060de890fdc3a42f25e1a0dc829c3c https://packages.wolfi.dev/os/aarch64/libxext-1.3.7-r4.apk /tmp/meri-native-repo/aarch64/libxext-1.3.7-r4.apk
ADD --checksum=sha256:b1103383c2263bc5722bc48cd6e722333e753030e279f2800bded732924c8a08 https://packages.wolfi.dev/os/aarch64/libxft-2.3.9-r8.apk /tmp/meri-native-repo/aarch64/libxft-2.3.9-r8.apk
ADD --checksum=sha256:3c76a370da61fc26789b0ac533ed76e442c9849b57564336856c7e0d224e9c8f https://packages.wolfi.dev/os/aarch64/libxml2-16-2.15.4-r1.apk /tmp/meri-native-repo/aarch64/libxml2-16-2.15.4-r1.apk
ADD --checksum=sha256:289d9377b9881056aca8dc4fc1205c0bb9267677b676917528c7390b48438a8d https://packages.wolfi.dev/os/aarch64/libxrender-0.9.13-r0.apk /tmp/meri-native-repo/aarch64/libxrender-0.9.13-r0.apk
ADD --checksum=sha256:8ae2c2ac0859e5a59c1cf771d5491dcdce9f7b6e373c808d5d99ccc7a40789b2 https://packages.wolfi.dev/os/aarch64/libzstd1-1.5.7-r12.apk /tmp/meri-native-repo/aarch64/libzstd1-1.5.7-r12.apk
ADD --checksum=sha256:ba996028cc4f3e1b4e4f42684d051257304ca065b7bd4fa20c5ee78f8b44ecb4 https://packages.wolfi.dev/os/aarch64/ncurses-6.6.20261024-r0.apk /tmp/meri-native-repo/aarch64/ncurses-6.6.20261024-r0.apk
ADD --checksum=sha256:a01c937f77c6d6e3f62fe67ef6a86f663409fdadf8ae18733d1227ec469814c7 https://packages.wolfi.dev/os/aarch64/ncurses-terminfo-base-6.6.20261024-r0.apk /tmp/meri-native-repo/aarch64/ncurses-terminfo-base-6.6.20261024-r0.apk
ADD --checksum=sha256:b5064f8ff42f91e2410812a7cc0e6278043132c0ef79ea6480f4c354bdd248a7 https://packages.wolfi.dev/os/aarch64/nghttp3-1.18.0-r3.apk /tmp/meri-native-repo/aarch64/nghttp3-1.18.0-r3.apk
ADD --checksum=sha256:c5c7b02654047fceacfc5e8fc7b3b99c8a2622a807bae880aacdbfc46c76f336 https://packages.wolfi.dev/os/aarch64/ngtcp2-1.25.0-r7.apk /tmp/meri-native-repo/aarch64/ngtcp2-1.25.0-r7.apk
ADD --checksum=sha256:e5f7f95f02c5209309d1cf014d08470cd9d2691b977d9ed644fea9bfb85d9046 https://packages.wolfi.dev/os/aarch64/openjpeg-2.5.4-r3.apk /tmp/meri-native-repo/aarch64/openjpeg-2.5.4-r3.apk
ADD --checksum=sha256:bbf9738a1960100008bcc6aba188ed7ce4a84c7873ddeb4ba5b19a2dda30dc1c https://packages.wolfi.dev/os/aarch64/openssl-3.6-libcrypto-3.6.5-r6.apk /tmp/meri-native-repo/aarch64/openssl-3.6-libcrypto-3.6.5-r6.apk
ADD --checksum=sha256:694c0e06540eed0d944cfd6c5fc11b247e62f183b989fd615fddf79b72e6247d https://packages.wolfi.dev/os/aarch64/openssl-3.6-libssl-3.6.5-r6.apk /tmp/meri-native-repo/aarch64/openssl-3.6-libssl-3.6.5-r6.apk
ADD --checksum=sha256:8a509f24f834724ea1927d5a37cd6e8fba5d7c98d0ea8fdea7689b27852e05fc https://packages.wolfi.dev/os/aarch64/openssl-4.0-libcrypto-4.0.3-r8.apk /tmp/meri-native-repo/aarch64/openssl-4.0-libcrypto-4.0.3-r8.apk
ADD --checksum=sha256:0dd48c2a58466c6787d0df2ff2254623c8f470faa6d986975a4c123ef04c6a9c https://packages.wolfi.dev/os/aarch64/openssl-4.0-libssl-4.0.3-r8.apk /tmp/meri-native-repo/aarch64/openssl-4.0-libssl-4.0.3-r8.apk
ADD --checksum=sha256:22313fca19b8143db5d239bd14c5251416a2e35ba7418b23b64ece7701bc9785 https://packages.wolfi.dev/os/aarch64/openssl-provider-legacy-allowed-4.1.0-r0.apk /tmp/meri-native-repo/aarch64/openssl-provider-legacy-allowed-4.1.0-r0.apk
ADD --checksum=sha256:cb8d36205e4d4fb099f82e8c94b172f419e964a62460f2eb435fa855095479d5 https://packages.wolfi.dev/os/aarch64/pango-1.58.2-r1.apk /tmp/meri-native-repo/aarch64/pango-1.58.2-r1.apk
ADD --checksum=sha256:a8cf3dcdca2012d1af78f22b31bb2abf4a656392b4f47f2bbdef1a959663ca81 https://packages.wolfi.dev/os/aarch64/pixman-0.46.4-r9.apk /tmp/meri-native-repo/aarch64/pixman-0.46.4-r9.apk
ADD --checksum=sha256:8d4ae6286e3fdc2b50fdd911fe1aa474c771c5708184e721e2255283ec6d7e4e https://packages.wolfi.dev/os/aarch64/readline-8.3-r3.apk /tmp/meri-native-repo/aarch64/readline-8.3-r3.apk
ADD --checksum=sha256:158a9e84fd8b3addfca5f3abfb02b754012d6e1d173d4467627d67541c5eafae https://packages.wolfi.dev/os/aarch64/sqlite-libs-3.54.1-r0.apk /tmp/meri-native-repo/aarch64/sqlite-libs-3.54.1-r0.apk
ADD --checksum=sha256:0973eb5b834a0b9f809630492359f3ae7320f73435b99d2423ca1e65e7c1a58f https://packages.wolfi.dev/os/aarch64/tiff-4.7.2-r5.apk /tmp/meri-native-repo/aarch64/tiff-4.7.2-r5.apk
ADD --checksum=sha256:2a6815ada2973deba196e24f4406fcd2619f6a070e693013563530705254a2b8 https://packages.wolfi.dev/os/aarch64/wolfi-baselayout-20230201-r30.apk /tmp/meri-native-repo/aarch64/wolfi-baselayout-20230201-r30.apk
ADD --checksum=sha256:d2c12615a9601d34f1500a782c38177d18417c576fe7b145e4e88b0165681874 https://packages.wolfi.dev/os/aarch64/xz-5.8.4-r0.apk /tmp/meri-native-repo/aarch64/xz-5.8.4-r0.apk
ADD --checksum=sha256:94eeec2403d0a8515362ba8ce6ce53d16f905d0b4f69ecf710d34db40cc1381a https://packages.wolfi.dev/os/aarch64/zlib-1.3.2.1_rc20260921-r1.apk /tmp/meri-native-repo/aarch64/zlib-1.3.2.1_rc20260921-r1.apk
ADD --checksum=sha256:5bac4b03f75d4c2548d29d135dff14e8be63493298f28dd4dae144b61f67e7ce https://packages.wolfi.dev/os/aarch64/clamav-1.5-scanner-1.5.2-r0.apk /tmp/meri-native-repo/aarch64/clamav-1.5-scanner-1.5.2-r0.apk
ADD --checksum=sha256:c6613152d9ebb613148d4672c40f2d55abe84404ec07ae8f1195f0129312483e https://packages.wolfi.dev/os/aarch64/clamav-1.5-freshclam-1.5.2-r0.apk /tmp/meri-native-repo/aarch64/clamav-1.5-freshclam-1.5.2-r0.apk
ADD --checksum=sha256:5360d1b790d8b2835321cb4b3231c66bf7bc36cac76cb920b84d015624b65cd2 https://packages.wolfi.dev/os/aarch64/tesseract-5.5.0-r2.apk /tmp/meri-native-repo/aarch64/tesseract-5.5.0-r2.apk
ADD --checksum=sha256:284483a771e9a8828b17bdf67eb7e7c9a6dd3d9f129f358dd7ea0e10eabe5050 https://packages.wolfi.dev/os/aarch64/tesseract-eng-5.5.2-r2.apk /tmp/meri-native-repo/aarch64/tesseract-eng-5.5.2-r2.apk
ADD --checksum=sha256:2db390ba3ff19c010e11cd75af6d36285264cd25fe24f5f5e7ecdb603eaae02e https://packages.wolfi.dev/os/aarch64/poppler-utils-26.03.0-r3.apk /tmp/meri-native-repo/aarch64/poppler-utils-26.03.0-r3.apk
ADD --checksum=sha256:dacdd5b4174dd5a2621e784f1dea9ad61bfb034ad1682e7f326417baf2163cdd https://packages.wolfi.dev/os/aarch64/poppler-26.03.0-r3.apk /tmp/meri-native-repo/aarch64/poppler-26.03.0-r3.apk
ADD --checksum=sha256:a22f29a723c0705f014bc2cb07848c94427728967d51147cc01ece5058557c81 https://packages.wolfi.dev/os/aarch64/leptonica-1.87.0-r1.apk /tmp/meri-native-repo/aarch64/leptonica-1.87.0-r1.apk
ADD --checksum=sha256:4655365de9a2bb2c75ddea905364dfe36026b24996924c65c7dc8645222c6739 https://packages.wolfi.dev/os/aarch64/libreoffice-26.8-26.8.2.2-r0.apk /tmp/meri-native-repo/aarch64/libreoffice-26.8-26.8.2.2-r0.apk
FROM ${RUNTIME_IMAGE} AS native-repo-3
ADD --checksum=sha256:e2fe9d841badfe86280ac708786a21b951e1dc7874a0949705da44447dd881e1 https://packages.wolfi.dev/os/aarch64/bubblewrap-0.13.1-r0.apk /tmp/meri-native-repo/aarch64/bubblewrap-0.13.1-r0.apk
ADD --checksum=sha256:f1c58ed46eded3d8751b43c221aa968a386e9a8e628684e4db802070538cf266 https://packages.wolfi.dev/os/aarch64/util-linux-misc-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/util-linux-misc-2.42.4-r1.apk
ADD --checksum=sha256:2f0ff74cd04a5c9c6a43404bb058e6fcf6e02b64d24d7f9f29740fee51372cd2 https://packages.wolfi.dev/os/aarch64/font-liberation-2.1.5-r6.apk /tmp/meri-native-repo/aarch64/font-liberation-2.1.5-r6.apk
ADD --checksum=sha256:02f7d7bec8e641734b52855a33ff5474d6b0c0be24e9244b76c20c3f48c20768 https://packages.wolfi.dev/os/aarch64/libstdc++-16.2.0-r1.apk /tmp/meri-native-repo/aarch64/libstdc++-16.2.0-r1.apk
ADD --checksum=sha256:032e5b2779dfedd065f0d7241757b79a47394e03babe2feb1833c92e2a2755dc https://packages.wolfi.dev/os/aarch64/libglvnd-1.7.0-r12.apk /tmp/meri-native-repo/aarch64/libglvnd-1.7.0-r12.apk
ADD --checksum=sha256:0baaae06fe50c478491eeaa686c8f443f8dd6969a3c5af8d6f2cb6c1a237519f https://packages.wolfi.dev/os/aarch64/python-3.13-base-3.13.16_git20261016-r2.apk /tmp/meri-native-repo/aarch64/python-3.13-base-3.13.16_git20261016-r2.apk
ADD --checksum=sha256:0d4deeb0c6f70a4afca1241a8250c5be5252a50bba72acff28d5f36dad9610d9 https://packages.wolfi.dev/os/aarch64/cups-libs-2.4.20-r0.apk /tmp/meri-native-repo/aarch64/cups-libs-2.4.20-r0.apk
ADD --checksum=sha256:0ea1994225a6c4c7967dbfec85ace0f6ef9aa81d26d8c730508c9bce8c4144c5 https://packages.wolfi.dev/os/aarch64/libxcursor-1.2.3-r7.apk /tmp/meri-native-repo/aarch64/libxcursor-1.2.3-r7.apk
ADD --checksum=sha256:0ee271413c53d5e92d080bdc78e3c0889327beca7881573792ef7441e13e8b66 https://packages.wolfi.dev/os/aarch64/libatk-1.0-2.62.1-r0.apk /tmp/meri-native-repo/aarch64/libatk-1.0-2.62.1-r0.apk
ADD --checksum=sha256:168a1625abdf2d6b6544498a5a740d5cd0424b1057b208c067320c44083c29de https://packages.wolfi.dev/os/aarch64/libxfixes-6.0.2-r4.apk /tmp/meri-native-repo/aarch64/libxfixes-6.0.2-r4.apk
ADD --checksum=sha256:1a0a67062db937c8c241a7590eaacac9d7fcb41b858b1baece06c417e40d2982 https://packages.wolfi.dev/os/aarch64/gtk-3-3.24.52-r5.apk /tmp/meri-native-repo/aarch64/gtk-3-3.24.52-r5.apk
ADD --checksum=sha256:22dd8d1fc95b5a882833f034b39e9632a7500a8b35e82f030cba5956fead0e69 https://packages.wolfi.dev/os/aarch64/libxi-1.8.4-r0.apk /tmp/meri-native-repo/aarch64/libxi-1.8.4-r0.apk
ADD --checksum=sha256:258840eec648177fc224de417203101b0f77b813e8abb79749a367e9858ca3c5 https://packages.wolfi.dev/os/aarch64/at-spi2-core-2.62.1-r0.apk /tmp/meri-native-repo/aarch64/at-spi2-core-2.62.1-r0.apk
ADD --checksum=sha256:2674e32336bdd994b87eb4bc1f3251360edc1cf16cbe3824506d5377614c3846 https://packages.wolfi.dev/os/aarch64/libepoxy-1.5.10-r12.apk /tmp/meri-native-repo/aarch64/libepoxy-1.5.10-r12.apk
ADD --checksum=sha256:283170342886c6b83c620bef200b7c14cd1d8b47e18d5edb428a6be6897cdb84 https://packages.wolfi.dev/os/aarch64/gpgme-1.24.3-r0.apk /tmp/meri-native-repo/aarch64/gpgme-1.24.3-r0.apk
ADD --checksum=sha256:2a35195ddb4d51e34bedb4c705e27a7066e30252430effe527e69fa72e67971d https://packages.wolfi.dev/os/aarch64/liblangtag-0.6.8-r5.apk /tmp/meri-native-repo/aarch64/liblangtag-0.6.8-r5.apk
ADD --checksum=sha256:2e142c6cfb00809a0aafe9d5c43db73087fd44ff038d546b430351ca053c5673 https://packages.wolfi.dev/os/aarch64/libxrandr-1.5.5-r7.apk /tmp/meri-native-repo/aarch64/libxrandr-1.5.5-r7.apk
ADD --checksum=sha256:2edcf4ac5ff50acd5a3fa804ddef9d46d8981958ddab4667bf5e333764156b55 https://packages.wolfi.dev/os/aarch64/py3-pip-wheel-26.2.2-r0.apk /tmp/meri-native-repo/aarch64/py3-pip-wheel-26.2.2-r0.apk
ADD --checksum=sha256:33f870386c306551f87680565a685a6ac44d7313ed540d9293554417e04829d1 https://packages.wolfi.dev/os/aarch64/opus-1.6.1-r5.apk /tmp/meri-native-repo/aarch64/opus-1.6.1-r5.apk
ADD --checksum=sha256:36deab0844a3f40227198193639b679eda4fc8bda3789c78eb34aaf95bf75c57 https://packages.wolfi.dev/os/aarch64/libxml2-2.15.0-r0.apk /tmp/meri-native-repo/aarch64/libxml2-2.15.0-r0.apk
ADD --checksum=sha256:382ea7166f5725c079846be85f60bb8efbead87828a8fad44705fb9194a6800b https://packages.wolfi.dev/os/aarch64/libseccomp-2.6.1-r4.apk /tmp/meri-native-repo/aarch64/libseccomp-2.6.1-r4.apk
ADD --checksum=sha256:38487d854241a61626b9a1d3aa67c4c487354847b54cc362d10cab834177f2d3 https://packages.wolfi.dev/os/aarch64/libsdl2-2.32.10-r5.apk /tmp/meri-native-repo/aarch64/libsdl2-2.32.10-r5.apk
ADD --checksum=sha256:3cafd792198fb80bdf34a78c818e9f5b04f447847611a32394d1c898f8c601f8 https://packages.wolfi.dev/os/aarch64/libldap-2.6-2.6.14-r0.apk /tmp/meri-native-repo/aarch64/libldap-2.6-2.6.14-r0.apk
ADD --checksum=sha256:3cdc633490edf569e0c1e18124b3dd26e8b916fb1c071e6a04d99b39d8d374f7 https://packages.wolfi.dev/os/aarch64/libfdisk-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/libfdisk-2.42.4-r1.apk
ADD --checksum=sha256:3e93db55e0ce02443379f9527dffe0aec1f1fb7538bb45fc3bf3e09a30dd0163 https://packages.wolfi.dev/os/aarch64/glycin-2-2.2.5-r0.apk /tmp/meri-native-repo/aarch64/glycin-2-2.2.5-r0.apk
ADD --checksum=sha256:462e5cb90686ba1be28046a3fd0fd1389839665abcc4c7ed40a71a183e2f0595 https://packages.wolfi.dev/os/aarch64/zstd-1.5.7-r12.apk /tmp/meri-native-repo/aarch64/zstd-1.5.7-r12.apk
ADD --checksum=sha256:4939ccc2819c60faa5d75013dea87886f6eeadd37f0f9116582372cd40a5cd7b https://packages.wolfi.dev/os/aarch64/libcap-2.78-r4.apk /tmp/meri-native-repo/aarch64/libcap-2.78-r4.apk
ADD --checksum=sha256:495c6d588e86b4d38b9ec9f5fe5f6e493688cebb382be781242383c3823a57f1 https://packages.wolfi.dev/os/aarch64/graphene-1.10.8-r12.apk /tmp/meri-native-repo/aarch64/graphene-1.10.8-r12.apk
ADD --checksum=sha256:4d4eee066ca56dda290dd672092f51063c0e4c6f9934ff3f42d9907ff12e2613 https://packages.wolfi.dev/os/aarch64/wayland-libs-egl-1.26.0-r3.apk /tmp/meri-native-repo/aarch64/wayland-libs-egl-1.26.0-r3.apk
ADD --checksum=sha256:5213a123c63fa2cac483c5de6ba91418722cc95f791378f2d48f1190ab0eac65 https://packages.wolfi.dev/os/aarch64/libsmartcols-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/libsmartcols-2.42.4-r1.apk
ADD --checksum=sha256:55010655a41ac8cfe80c701c398a150fbdbf231306c49581def5739032e90330 https://packages.wolfi.dev/os/aarch64/fstrim-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/fstrim-2.42.4-r1.apk
ADD --checksum=sha256:572240b65088e46ce6dd65f2ffbf8d2f746a87664adb9054ef7daf478b2988d8 https://packages.wolfi.dev/os/aarch64/libxtst-1.2.6-r0.apk /tmp/meri-native-repo/aarch64/libxtst-1.2.6-r0.apk
ADD --checksum=sha256:5784ba4cbc4f552cb36e3725464886ce45fc9a51249d12eefda223be75efbe77 https://packages.wolfi.dev/os/aarch64/libcmis-0.6.3-r4.apk /tmp/meri-native-repo/aarch64/libcmis-0.6.3-r4.apk
ADD --checksum=sha256:581f219aa171b2f815211c702dfc117c0fecd8f5c40da285c67c98ee00074f9d https://packages.wolfi.dev/os/aarch64/gdk-pixbuf-2.44.8-r5.apk /tmp/meri-native-repo/aarch64/gdk-pixbuf-2.44.8-r5.apk
ADD --checksum=sha256:6183eb1605076ed5b2ae7d5be92eeb98b1d6353c44d2d203e4f167e6be983818 https://packages.wolfi.dev/os/aarch64/libsystemd-compression-libs-262.1-r1.apk /tmp/meri-native-repo/aarch64/libsystemd-compression-libs-262.1-r1.apk
ADD --checksum=sha256:62beec958d0e9989f4a618a74d798f8bc88a67d441eabcce746465224d815f2d https://packages.wolfi.dev/os/aarch64/libopenjph0.32-0.32.0-r0.apk /tmp/meri-native-repo/aarch64/libopenjph0.32-0.32.0-r0.apk
ADD --checksum=sha256:63ad89463dd6cbb0c682bef6aabdc9896e2708cb42c05bcc33d6bf0dd5ed3bab https://packages.wolfi.dev/os/aarch64/libuuid-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/libuuid-2.42.4-r1.apk
ADD --checksum=sha256:6a3b8fa56ff3b4d466866669d796aa23ea1064b51d8dcb0d73b399dfb770f55d https://packages.wolfi.dev/os/aarch64/libsystemd-262.1-r1.apk /tmp/meri-native-repo/aarch64/libsystemd-262.1-r1.apk
ADD --checksum=sha256:6bed5066575718aede41dbf653ea301f32b1e826c27868a679cd30bfa42378ee https://packages.wolfi.dev/os/aarch64/glycin-2-libs-2.2.5-r0.apk /tmp/meri-native-repo/aarch64/glycin-2-libs-2.2.5-r0.apk
ADD --checksum=sha256:713630cff32fc4116b0aa491565bb1f0fdad210ea48bade2b502d3475d094dab https://packages.wolfi.dev/os/aarch64/py3.13-pip-26.2.2-r0.apk /tmp/meri-native-repo/aarch64/py3.13-pip-26.2.2-r0.apk
ADD --checksum=sha256:749913adccebf88bc0c8596810fb1231dd5e08b9715e3416e1e8f58de37a3317 https://packages.wolfi.dev/os/aarch64/openh264-2.7.0-r0.apk /tmp/meri-native-repo/aarch64/openh264-2.7.0-r0.apk
ADD --checksum=sha256:76ae4a7c37e3c2f00e40ad9affea2b7fcd5bab7a476cfd33dcfe5d70c8913e4f https://packages.wolfi.dev/os/aarch64/libx265-216-4.2-r2.apk /tmp/meri-native-repo/aarch64/libx265-216-4.2-r2.apk
ADD --checksum=sha256:780864c286ee3ccb774b7d2ab215599095d1252ef40b907f843bc2a8080f3622 https://packages.wolfi.dev/os/aarch64/libdrm-2.4.134-r0.apk /tmp/meri-native-repo/aarch64/libdrm-2.4.134-r0.apk
ADD --checksum=sha256:7b04c65d8026079edad3a5ae5ad00dad509dbd7359f5f4c858eb77e3593ac76c https://packages.wolfi.dev/os/aarch64/py3.13-setuptools-84.2.1-r0.apk /tmp/meri-native-repo/aarch64/py3.13-setuptools-84.2.1-r0.apk
ADD --checksum=sha256:7ffed60387aafd738e1435072b8948e28bbf7718835455eaf438af143232bcfa https://packages.wolfi.dev/os/aarch64/libde265-1.1.3-r0.apk /tmp/meri-native-repo/aarch64/libde265-1.1.3-r0.apk
ADD --checksum=sha256:83d295f369d1396bae0e9a84b6014e9857dba40a1ac4d5215662c34d229e01ce https://packages.wolfi.dev/os/aarch64/py3.13-pip-base-26.2.2-r0.apk /tmp/meri-native-repo/aarch64/py3.13-pip-base-26.2.2-r0.apk
ADD --checksum=sha256:895d413f7fab456176e58657ced82d58ddd16863c46f848c7db8e70b3df4b064 https://packages.wolfi.dev/os/aarch64/libxkbcommon-1.13.2-r4.apk /tmp/meri-native-repo/aarch64/libxkbcommon-1.13.2-r4.apk
FROM ${RUNTIME_IMAGE} AS native-repo-4
ADD --checksum=sha256:8a1f12289bb129fafbda269ec2dd2347a62b755122c72ac8680b72491b882467 https://packages.wolfi.dev/os/aarch64/libvorbis-1.3.7-r14.apk /tmp/meri-native-repo/aarch64/libvorbis-1.3.7-r14.apk
ADD --checksum=sha256:8b0d57d91b572c8e44dd6fc96e388673a5f5c5d16410c50488b968e1805b8d32 https://packages.wolfi.dev/os/aarch64/xkeyboard-config-2.49-r0.apk /tmp/meri-native-repo/aarch64/xkeyboard-config-2.49-r0.apk
ADD --checksum=sha256:8f633d68062d4437958ebb7dfbd37647c2d5decde3dd8d0ebbeef723a33f007d https://packages.wolfi.dev/os/aarch64/nsenter-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/nsenter-2.42.4-r1.apk
ADD --checksum=sha256:923cab5fcdc646ea76ddebfd38626998d787cc10baff0803e3365d1e2bd5ef41 https://packages.wolfi.dev/os/aarch64/libatomic-16.2.0-r1.apk /tmp/meri-native-repo/aarch64/libatomic-16.2.0-r1.apk
ADD --checksum=sha256:932f3fe806304ebfc412156c179b8b64c41ccae96900fea335a99f1d8f308420 https://packages.wolfi.dev/os/aarch64/libdav1d-1.5.4-r4.apk /tmp/meri-native-repo/aarch64/libdav1d-1.5.4-r4.apk
ADD --checksum=sha256:950f018c30e648b05a2f2f4a5d6033802ad5589a8ea9860a73a8cf824611ca6e https://packages.wolfi.dev/os/aarch64/gstreamer-1.29.2-r4.apk /tmp/meri-native-repo/aarch64/gstreamer-1.29.2-r4.apk
ADD --checksum=sha256:96fad2b9fcde9c423a80ce94979b19b501ea3ca464682248b226c2f9e7aaeb92 https://packages.wolfi.dev/os/aarch64/linux-pam-1.7.3-r1.apk /tmp/meri-native-repo/aarch64/linux-pam-1.7.3-r1.apk
ADD --checksum=sha256:98246ee29e43b4f0c3ddb3cf66c8bdc69e1847cabcaaa8ab0aa7e8d7e8daed16 https://packages.wolfi.dev/os/aarch64/gtk-3-update-icon-cache-3.24.52-r5.apk /tmp/meri-native-repo/aarch64/gtk-3-update-icon-cache-3.24.52-r5.apk
ADD --checksum=sha256:999e5a89cfa1e684a3cef946f05662fe5fab38ef3aede13ebac0875e65388ac9 https://packages.wolfi.dev/os/aarch64/libxv-1.0.13-r7.apk /tmp/meri-native-repo/aarch64/libxv-1.0.13-r7.apk
ADD --checksum=sha256:9cefe4bc29a914b6cd104d3130fa1efee96e029094427f15aa77e9366eff8649 https://packages.wolfi.dev/os/aarch64/avahi-libs-0.9_rc5-r3.apk /tmp/meri-native-repo/aarch64/avahi-libs-0.9_rc5-r3.apk
ADD --checksum=sha256:9f4aa9d7dc9f3857bf4eb35bec9e41931edaabd5a63fbab5d0557c78aa9268d2 https://packages.wolfi.dev/os/aarch64/wayland-libs-client-1.26.0-r3.apk /tmp/meri-native-repo/aarch64/wayland-libs-client-1.26.0-r3.apk
ADD --checksum=sha256:a09d28d0ae16d66dc9dac56478ff0af7f621201c1339749c44a912f7f12e2921 https://packages.wolfi.dev/os/aarch64/cairo-gobject-1.18.6-r1.apk /tmp/meri-native-repo/aarch64/cairo-gobject-1.18.6-r1.apk
ADD --checksum=sha256:a139291a6f58dd83c8669ba9757f26941f96d7edbaad88bbfb8f62a5c737613b https://packages.wolfi.dev/os/aarch64/libgpg-error-1.61-r6.apk /tmp/meri-native-repo/aarch64/libgpg-error-1.61-r6.apk
ADD --checksum=sha256:a2005cd179bbf3ec32b61b15b5d0ebf4509c6ceaa2cb7514a01524bab8e4a923 https://packages.wolfi.dev/os/aarch64/libxinerama-1.1.6-r2.apk /tmp/meri-native-repo/aarch64/libxinerama-1.1.6-r2.apk
ADD --checksum=sha256:a2b0c0508b07d4e0187d7c9bd231b71d56f195a528b55815e89735d9fa8caef7 https://packages.wolfi.dev/os/aarch64/mpdecimal-4.0.1-r6.apk /tmp/meri-native-repo/aarch64/mpdecimal-4.0.1-r6.apk
ADD --checksum=sha256:a418d69ce51bfeafd24a505e483b74fdb52cfc98a2d43cd8ce8d9670745801b9 https://packages.wolfi.dev/os/aarch64/bash-5.3-r14.apk /tmp/meri-native-repo/aarch64/bash-5.3-r14.apk
ADD --checksum=sha256:ad05c3a03fd0f7711bf614b0cdb971f045986f2e63396587bb7f7900d7f5d6b6 https://packages.wolfi.dev/os/aarch64/alsa-lib-1.2.16.1-r5.apk /tmp/meri-native-repo/aarch64/alsa-lib-1.2.16.1-r5.apk
ADD --checksum=sha256:af04e91ef0bcff716aedd8490e710fe85f6022aa98518026a9ab99166ab8e394 https://packages.wolfi.dev/os/aarch64/dbus-libs-1.16.2-r9.apk /tmp/meri-native-repo/aarch64/dbus-libs-1.16.2-r9.apk
ADD --checksum=sha256:b0fdf40685ec4239a38a0cbd91af1778c4759221b03c3b167c4109a9b6238c05 https://packages.wolfi.dev/os/aarch64/libatk-bridge-2.0-2.62.1-r0.apk /tmp/meri-native-repo/aarch64/libatk-bridge-2.0-2.62.1-r0.apk
ADD --checksum=sha256:b162352e070a74f7dab831375f8430e1c108a5c5d1dde079b1c5a84b4ac0b725 https://packages.wolfi.dev/os/aarch64/shared-mime-info-2.5.1-r3.apk /tmp/meri-native-repo/aarch64/shared-mime-info-2.5.1-r3.apk
ADD --checksum=sha256:b81d14544860ff560245b38bb51c21ca3d1179b5b3833355f1d5360d1c3f1fc9 https://packages.wolfi.dev/os/aarch64/librsvg-2.63.4-r0.apk /tmp/meri-native-repo/aarch64/librsvg-2.63.4-r0.apk
ADD --checksum=sha256:bc5a02f284fa438c9ca8ae69ef708a7e5a0f890ca75639af8638ae5a352a34e8 https://packages.wolfi.dev/os/aarch64/brotli-dev-1.2.1-r2.apk /tmp/meri-native-repo/aarch64/brotli-dev-1.2.1-r2.apk
ADD --checksum=sha256:c1622683eee6d1294a18649f21e1b5403a165c32a10afd702f8c63af17f3eb37 https://packages.wolfi.dev/os/aarch64/aom-libs-3.15.2-r0.apk /tmp/meri-native-repo/aarch64/aom-libs-3.15.2-r0.apk
ADD --checksum=sha256:c1add921f52eb8d25bc4f451c0fd6c1f38708fdd87f03015e429886b23ddbdfd https://packages.wolfi.dev/os/aarch64/busybox-1.38.0-r3.apk /tmp/meri-native-repo/aarch64/busybox-1.38.0-r3.apk
ADD --checksum=sha256:c3e162065d493add318143b5b8c24e650a5c80da72abdf7d60784e743ea1713f https://packages.wolfi.dev/os/aarch64/util-linux-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/util-linux-2.42.4-r1.apk
ADD --checksum=sha256:c48e3434cbf1dd36284b63314f91436ac3f4f0ab78a8b10ec176f8dd94d9e616 https://packages.wolfi.dev/os/aarch64/setarch-2.42.4-r1.apk /tmp/meri-native-repo/aarch64/setarch-2.42.4-r1.apk
ADD --checksum=sha256:c604bda0a2e9b9f983bf1a4ffd19c1cad21e7fa66075f3f2b483b11d6d823241 https://packages.wolfi.dev/os/aarch64/libxcomposite-0.4.7-r5.apk /tmp/meri-native-repo/aarch64/libxcomposite-0.4.7-r5.apk
ADD --checksum=sha256:c7174dc91785391424a9eeeee70c11f3e7f9f9d251e6fbfd4f6427d9bb5f9ebd https://packages.wolfi.dev/os/aarch64/libogg-1.3.6-r5.apk /tmp/meri-native-repo/aarch64/libogg-1.3.6-r5.apk
ADD --checksum=sha256:c9545a724877f79b97d76ebeac8334842b47db65d9d2d2003f827a1597c70047 https://packages.wolfi.dev/os/aarch64/libjxl-0.12.0-r3.apk /tmp/meri-native-repo/aarch64/libjxl-0.12.0-r3.apk
ADD --checksum=sha256:ca6696f9c6342d1d0f04e945dbc249fd0447794bbf24c580a047832dd94ec6ba https://packages.wolfi.dev/os/aarch64/libxdamage-1.1.7-r5.apk /tmp/meri-native-repo/aarch64/libxdamage-1.1.7-r5.apk
ADD --checksum=sha256:ceeacb3d8826a1872c5cf2f05b4627593efe3adce76c5156de32857f252f7cd3 https://packages.wolfi.dev/os/aarch64/python-3.12-base-3.12.16-r1.apk /tmp/meri-native-repo/aarch64/python-3.12-base-3.12.16-r1.apk
ADD --checksum=sha256:d0b831a8134d8d931461443e833d423234b5b51eb376a39a1465d055dd529b45 https://packages.wolfi.dev/os/aarch64/libsvtav1enc4-4.2.0-r2.apk /tmp/meri-native-repo/aarch64/libsvtav1enc4-4.2.0-r2.apk
ADD --checksum=sha256:d1421552e31a5db97bf4130ec1bb3ebe07e56e40ddd14dc2429e6d63088efe61 https://packages.wolfi.dev/os/aarch64/gst-plugins-base-1.29.2-r3.apk /tmp/meri-native-repo/aarch64/gst-plugins-base-1.29.2-r3.apk
ADD --checksum=sha256:d6d555e649bf680779279931189e8456632d0df1c681862a52cb1e7200ed770c https://packages.wolfi.dev/os/aarch64/apk-tools-2.14.12-r0.apk /tmp/meri-native-repo/aarch64/apk-tools-2.14.12-r0.apk
ADD --checksum=sha256:d6e33f10c615d9bfd8e51ea6917baa9555526d39e1e07891085de550ebc6a7e7 https://packages.wolfi.dev/os/aarch64/orc-0.4.44-r0.apk /tmp/meri-native-repo/aarch64/orc-0.4.44-r0.apk
ADD --checksum=sha256:de9021cd1de03f0fbfdc3596a46a579a481d8b04ebb90e3a2525aec67ec323b0 https://packages.wolfi.dev/os/aarch64/libsm-1.2.6-r6.apk /tmp/meri-native-repo/aarch64/libsm-1.2.6-r6.apk
ADD --checksum=sha256:e137af1d7edf4b8c40589087bd9990bf52889c8808d5d9d5482cbcaae294d70f https://packages.wolfi.dev/os/aarch64/libassuan-3.0.2-r12.apk /tmp/meri-native-repo/aarch64/libassuan-3.0.2-r12.apk
ADD --checksum=sha256:e27930aba23159e4f85723271aeb78d57555ec0cbdce8464d84f186e90262db7 https://packages.wolfi.dev/os/aarch64/libboost-program_options1.92.0-1.92.0-r3.apk /tmp/meri-native-repo/aarch64/libboost-program_options1.92.0-1.92.0-r3.apk
ADD --checksum=sha256:e641179fe3e0357928c3edd8d8d1ae0cc55a4db19600358aa7c4029c8476f853 https://packages.wolfi.dev/os/aarch64/lz4-1.10.0-r11.apk /tmp/meri-native-repo/aarch64/lz4-1.10.0-r11.apk
ADD --checksum=sha256:e96ab85096c17f607c99e025bb9047c590195583096ce3ea0d857ec77ea3c55d https://packages.wolfi.dev/os/aarch64/libice-1.1.2-r8.apk /tmp/meri-native-repo/aarch64/libice-1.1.2-r8.apk
ADD --checksum=sha256:ebbd4c32ddea2408a8d7f938a1fb31a994da01d7b15351f12ef1ea64ccd1ce0e https://packages.wolfi.dev/os/aarch64/libtheora-1.2.0-r10.apk /tmp/meri-native-repo/aarch64/libtheora-1.2.0-r10.apk
ADD --checksum=sha256:ec5c434e7baeed78102d684cca26d8bad793d8408719dbed836c26f3bac7e97f https://packages.wolfi.dev/os/aarch64/python-3.13-3.13.16_git20261016-r2.apk /tmp/meri-native-repo/aarch64/python-3.13-3.13.16_git20261016-r2.apk
ADD --checksum=sha256:ec68f956c38a01460bc0fd35f35b845e3fb15a5b43fc7838a65c5d2e9919c9a2 https://packages.wolfi.dev/os/aarch64/brotli-1.2.1-r2.apk /tmp/meri-native-repo/aarch64/brotli-1.2.1-r2.apk
ADD --checksum=sha256:ee1d0c652a89932c9f1b3d1e8c348bd1a18329f32a1a63eaa1aaae9dd3eb6994 https://packages.wolfi.dev/os/aarch64/rav1e-0.8.1-r13.apk /tmp/meri-native-repo/aarch64/rav1e-0.8.1-r13.apk
ADD --checksum=sha256:ef0fed8829139b2b1ec2589d1be348855fdd6e27a0406bb4635d605c4c23131c https://packages.wolfi.dev/os/aarch64/wayland-libs-cursor-1.26.0-r3.apk /tmp/meri-native-repo/aarch64/wayland-libs-cursor-1.26.0-r3.apk
ADD --checksum=sha256:fa871a64e10623a12ee58086b59e8a1ffe195805d3a254121bad704bb7628857 https://packages.wolfi.dev/os/aarch64/argon2-20190702-r9.apk /tmp/meri-native-repo/aarch64/argon2-20190702-r9.apk
ADD --checksum=sha256:fc36e4dd53d901cf868cbe55a000a496e84cf220317a0db8cbdfc35a97193f55 https://packages.wolfi.dev/os/aarch64/libheif-1.23.7-r1.apk /tmp/meri-native-repo/aarch64/libheif-1.23.7-r1.apk
# ---------------------------------------------------------------------------------------------------------
# SCRUM-197: build-only stages for the source-built ClamAV payload.
#
# The retained image installs the Wolfi clamav-1.5 family (engine 1.5.2-r7, scanner and freshclam 1.5.2-r0) and the
# retained image scan reports the seven HIGH advisories Cisco fixed in ClamAV 1.5.4 (registry
# sha256:93bc564d18d912a0af53ec2b9c97994324b752e9f9b34000218d2898e6babe7c, COMPLETE 14:59:42). The vendor feed declares a
# fixed revision, clamav-1.5 1.5.4-r2, that no Wolfi or Chainguard apk repository publishes for aarch64 or x86_64, so the
# payload is built from the authenticated upstream release asset rather than replaced by a distribution package.
#
# Every instruction below is build-only: the compiler, the Rust toolchain, the development headers and the build tree
# stay in stages that are not the exported stage, and the runtime stage receives only the installed payload. The
# compiler/development closure is resolved from the same retained vendor-signed index the three native layers already
# install from (136 official aarch64 archives, pinned by exact URL and sha256 in the ADD --checksum list and in the lock's
# uploadNativeProvenance.clamavSourcePreparation.buildClosure). The ClamAV release asset, its detached signature, the
# Cisco Talos public key and the official Rust toolchain with its release key are fetched at those exact bytes.
#
# The toolchain input is not incidental: ClamAV 1.5.x requires a Rust toolchain (cmake/FindRust.cmake requires the
# rustc/cargo target to be aarch64-unknown-linux-gnu, and the release asset carries its 290 vendored crates in
# .cargo/vendor so the build resolves offline), and neither the retained index nor the live Wolfi index publishes any
# rust or cargo package for aarch64. The official Rust distribution is therefore the authenticated source for it, pinned
# by the same URL + sha256 pattern as every other staged input, and recorded as an external input rather than presented
# as a distribution package.

FROM ${RUNTIME_IMAGE} AS native-dev-repo-1
ADD --checksum=sha256:a418d69ce51bfeafd24a505e483b74fdb52cfc98a2d43cd8ce8d9670745801b9 https://packages.wolfi.dev/os/aarch64/bash-5.3-r14.apk /tmp/meri-native-dev-repo/aarch64/bash-5.3-r14.apk
ADD --checksum=sha256:ed3e438fccc427064cee079dde807c7c6f6d79dc9b84aeed52f3711d57e2a7aa https://packages.wolfi.dev/os/aarch64/binutils-2.47-r2.apk /tmp/meri-native-dev-repo/aarch64/binutils-2.47-r2.apk
ADD --checksum=sha256:ec68f956c38a01460bc0fd35f35b845e3fb15a5b43fc7838a65c5d2e9919c9a2 https://packages.wolfi.dev/os/aarch64/brotli-1.2.1-r2.apk /tmp/meri-native-dev-repo/aarch64/brotli-1.2.1-r2.apk
ADD --checksum=sha256:bc5a02f284fa438c9ca8ae69ef708a7e5a0f890ca75639af8638ae5a352a34e8 https://packages.wolfi.dev/os/aarch64/brotli-dev-1.2.1-r2.apk /tmp/meri-native-dev-repo/aarch64/brotli-dev-1.2.1-r2.apk
ADD --checksum=sha256:34af19f4c87d77e890c4526bce45f0f20f450a1fa9b9f706ee380e0e06ed1812 https://packages.wolfi.dev/os/aarch64/bzip2-dev-1.0.8-r28.apk /tmp/meri-native-dev-repo/aarch64/bzip2-dev-1.0.8-r28.apk
ADD --checksum=sha256:54d05cfba6e3c49483de141bd163f7986a03ca3f6d39ca6d13756af534d2d247 https://packages.wolfi.dev/os/aarch64/c-ares-1.34.9-r0.apk /tmp/meri-native-dev-repo/aarch64/c-ares-1.34.9-r0.apk
ADD --checksum=sha256:d2a458ae71b3f6f65302a8dd61c35f75f3eef87aeb5583a3f97523e99698cf49 https://packages.wolfi.dev/os/aarch64/ca-certificates-bundle-20261020-r0.apk /tmp/meri-native-dev-repo/aarch64/ca-certificates-bundle-20261020-r0.apk
ADD --checksum=sha256:d312109c417fde5732c6ad001ad0363c5f81a7d148a0dc895dcab106ee0e7788 https://packages.wolfi.dev/os/aarch64/check-0.15.2-r10.apk /tmp/meri-native-dev-repo/aarch64/check-0.15.2-r10.apk
ADD --checksum=sha256:e83abc418a9a2ea64a9b8c1a223555ddf2f3622261a85b71fa7b2c25dfa56c4b https://packages.wolfi.dev/os/aarch64/check-dev-0.15.2-r10.apk /tmp/meri-native-dev-repo/aarch64/check-dev-0.15.2-r10.apk
ADD --checksum=sha256:05fee361fdbd9002623209173e5101935d5f0cc1c82d3cd9e1e5c6c0a55df1d3 https://packages.wolfi.dev/os/aarch64/cmake-4.4.3-r0.apk /tmp/meri-native-dev-repo/aarch64/cmake-4.4.3-r0.apk
ADD --checksum=sha256:2be4a49b2a273992e10b009c358bf3b4932429fbf7e749534a4924df791a1454 https://packages.wolfi.dev/os/aarch64/curl-dev-8.23.0-r2.apk /tmp/meri-native-dev-repo/aarch64/curl-dev-8.23.0-r2.apk
ADD --checksum=sha256:4d953f1db918d026e9a84fd630609668f8617cdbcf1a316f459bea9281f911ed https://packages.wolfi.dev/os/aarch64/cyrus-sasl-heimdal-libs-2.1.28-r58.apk /tmp/meri-native-dev-repo/aarch64/cyrus-sasl-heimdal-libs-2.1.28-r58.apk
ADD --checksum=sha256:0a78805556cf6200193caa6456ffa9e589cf44718bcef5c84d207b7cf60f2850 https://packages.wolfi.dev/os/aarch64/gawk-5.4.1-r4.apk /tmp/meri-native-dev-repo/aarch64/gawk-5.4.1-r4.apk
ADD --checksum=sha256:46b46236fe3d73b4ed55cc8cdfcf975037e3fa1413c369c0ca3015714f7a926f https://packages.wolfi.dev/os/aarch64/gcc-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/gcc-16.2.0-r2.apk
ADD --checksum=sha256:7c809eeb4a0a2a7ecbbbe92a70abecfccfc5c17ea40144798e8b389dc25ac7e8 https://packages.wolfi.dev/os/aarch64/gdbm-1.26-r9.apk /tmp/meri-native-dev-repo/aarch64/gdbm-1.26-r9.apk
ADD --checksum=sha256:ed2992c52a57877ae5006b4c212393851bf61dc4c440f6519fd207f326952c6f https://packages.wolfi.dev/os/aarch64/glibc-2.43-r13.apk /tmp/meri-native-dev-repo/aarch64/glibc-2.43-r13.apk
ADD --checksum=sha256:5ec2e2a087ca0f82e8c66fee61ff47637d2d65232b2843aaa58d560ec4596907 https://packages.wolfi.dev/os/aarch64/glibc-2.44-2.44-r10.apk /tmp/meri-native-dev-repo/aarch64/glibc-2.44-2.44-r10.apk
ADD --checksum=sha256:8cb458ec8470eeffbf1938401e082b437e55b384eb3a2035cccfa4e8ba75acdd https://packages.wolfi.dev/os/aarch64/glibc-2.44-dev-2.44-r10.apk /tmp/meri-native-dev-repo/aarch64/glibc-2.44-dev-2.44-r10.apk
ADD --checksum=sha256:2b4056feb07b9abd06d58a7c1031967c5b2d4cefe128e986170dbc1deb338fa4 https://packages.wolfi.dev/os/aarch64/glibc-2.44-locale-posix-2.44-r10.apk /tmp/meri-native-dev-repo/aarch64/glibc-2.44-locale-posix-2.44-r10.apk
ADD --checksum=sha256:b38a6630cf85f3d726b36d8a9544c3d2a643b30d182af30e0ff634a8e000e2c7 https://packages.wolfi.dev/os/aarch64/gmp-6.3.0-r12.apk /tmp/meri-native-dev-repo/aarch64/gmp-6.3.0-r12.apk
ADD --checksum=sha256:d23f4bca40e2665011f257ee2cd84886f7ed5aa679e3a7b0837b69fb8d4b5ee6 https://packages.wolfi.dev/os/aarch64/gpgv-2.4.9-r12.apk /tmp/meri-native-dev-repo/aarch64/gpgv-2.4.9-r12.apk
ADD --checksum=sha256:e2292206c78ed1aac2047d4be70cd3ab5992efcbba5065f1d9ceeff07c1ec437 https://packages.wolfi.dev/os/aarch64/heimdal-libs-7.8.0-r54.apk /tmp/meri-native-dev-repo/aarch64/heimdal-libs-7.8.0-r54.apk
ADD --checksum=sha256:2732113c83570ae8c3de42dbeac422981600b51a15ee703a7ca9326ba2918954 https://packages.wolfi.dev/os/aarch64/isl-0.28-r6.apk /tmp/meri-native-dev-repo/aarch64/isl-0.28-r6.apk
ADD --checksum=sha256:ed8464ea37ad9d4f008c17864a5b97bbe1b41969c79b4c9913921eb965db267e https://packages.wolfi.dev/os/aarch64/json-c-0.19-r2.apk /tmp/meri-native-dev-repo/aarch64/json-c-0.19-r2.apk
ADD --checksum=sha256:437c34f849dd0d4da92743cbac5ccdaaa984e2cffc1328d069df1ca940c83ad9 https://packages.wolfi.dev/os/aarch64/json-c-dev-0.19-r2.apk /tmp/meri-native-dev-repo/aarch64/json-c-dev-0.19-r2.apk
ADD --checksum=sha256:7a2faec0b8e9163676c73f54fc3b6a1621b99683cd9b0ebec0c40223b6bc347b https://packages.wolfi.dev/os/aarch64/jsoncpp-1.9.8-r6.apk /tmp/meri-native-dev-repo/aarch64/jsoncpp-1.9.8-r6.apk
ADD --checksum=sha256:fc8f8f28e6472244ebad031f585fcb86a0b870c4f4e5f1415943b76afbf3e4b0 https://packages.wolfi.dev/os/aarch64/keyutils-libs-1.6.3-r41.apk /tmp/meri-native-dev-repo/aarch64/keyutils-libs-1.6.3-r41.apk
ADD --checksum=sha256:6a933ca1514f76081d839361a01313cae7c5381a5a9e8130ef38cb75d00b20f0 https://packages.wolfi.dev/os/aarch64/krb5-conf-1.0-r10.apk /tmp/meri-native-dev-repo/aarch64/krb5-conf-1.0-r10.apk
ADD --checksum=sha256:bde3fb18cc946f07cde48c022c690650ba8476f27fa973a1cbaa7a4deea36c39 https://packages.wolfi.dev/os/aarch64/krb5-libs-1.22.2-r5.apk /tmp/meri-native-dev-repo/aarch64/krb5-libs-1.22.2-r5.apk
ADD --checksum=sha256:f69972a7647987c61a1a29bc7c1854458bd351fb7a191c7f51e27a683769dad0 https://packages.wolfi.dev/os/aarch64/ld-linux-2.44-2.44-r10.apk /tmp/meri-native-dev-repo/aarch64/ld-linux-2.44-2.44-r10.apk
ADD --checksum=sha256:4ab67d18cbdb44c3b37c543b6e735583ef757696e4d11dedc88c20c165a4ee8f https://packages.wolfi.dev/os/aarch64/libacl1-2.4.0-r4.apk /tmp/meri-native-dev-repo/aarch64/libacl1-2.4.0-r4.apk
ADD --checksum=sha256:72ec9ba6472af3213a09b9674b7bba7ea2aa1ecdf0dee09e4a24a9108db5598f https://packages.wolfi.dev/os/aarch64/libarchive-3.8.10-r0.apk /tmp/meri-native-dev-repo/aarch64/libarchive-3.8.10-r0.apk
ADD --checksum=sha256:e137af1d7edf4b8c40589087bd9990bf52889c8808d5d9d5482cbcaae294d70f https://packages.wolfi.dev/os/aarch64/libassuan-3.0.2-r12.apk /tmp/meri-native-dev-repo/aarch64/libassuan-3.0.2-r12.apk
ADD --checksum=sha256:923cab5fcdc646ea76ddebfd38626998d787cc10baff0803e3365d1e2bd5ef41 https://packages.wolfi.dev/os/aarch64/libatomic-16.2.0-r1.apk /tmp/meri-native-dev-repo/aarch64/libatomic-16.2.0-r1.apk
FROM ${RUNTIME_IMAGE} AS native-dev-repo-2
ADD --checksum=sha256:5a71e1e2255f6e85cf501b60a34584e097fe743a91bf0e60338376ddc5a24090 https://packages.wolfi.dev/os/aarch64/libbrotlicommon1-1.2.1-r2.apk /tmp/meri-native-dev-repo/aarch64/libbrotlicommon1-1.2.1-r2.apk
ADD --checksum=sha256:29b9fcc4d55fea32dbe590a2e3de0459109c8103b6dc568e650e0e6395280a82 https://packages.wolfi.dev/os/aarch64/libbrotlidec1-1.2.1-r2.apk /tmp/meri-native-dev-repo/aarch64/libbrotlidec1-1.2.1-r2.apk
ADD --checksum=sha256:14ba019e5e959d8f4ae06f6a6c9e1014842b730d2a10a2fbb66fb780523910f7 https://packages.wolfi.dev/os/aarch64/libbrotlienc1-1.2.1-r2.apk /tmp/meri-native-dev-repo/aarch64/libbrotlienc1-1.2.1-r2.apk
ADD --checksum=sha256:46ce3328e2372eadeb71ef1dc179e2427cefa2264bc0e90e8749e4fee7d644f9 https://packages.wolfi.dev/os/aarch64/libbz2-1-1.0.8-r28.apk /tmp/meri-native-dev-repo/aarch64/libbz2-1-1.0.8-r28.apk
ADD --checksum=sha256:e7e46a09271baccf16553997096d72a9059437a527f10331a12fc6a2f18c5d45 https://packages.wolfi.dev/os/aarch64/libcom_err-1.47.4-r5.apk /tmp/meri-native-dev-repo/aarch64/libcom_err-1.47.4-r5.apk
ADD --checksum=sha256:40c7bfd615a69e8747d3a5d0ca9a37dc2a8b169bcd4c2df4b387922d9fe5b553 https://packages.wolfi.dev/os/aarch64/libcrypt1-2.44-2.44-r10.apk /tmp/meri-native-dev-repo/aarch64/libcrypt1-2.44-2.44-r10.apk
ADD --checksum=sha256:1cd0edb0d40aaeb5281566f4c4d17583447b77b74e1bc3281de642e8e9493bf1 https://packages.wolfi.dev/os/aarch64/libcurl-openssl4-8.23.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libcurl-openssl4-8.23.0-r2.apk
ADD --checksum=sha256:9770863d1476c24a11ae86cb73366eabfd4310421b51fd1c08da9b5c5fa335c3 https://packages.wolfi.dev/os/aarch64/libedit-3.1-r20.apk /tmp/meri-native-dev-repo/aarch64/libedit-3.1-r20.apk
ADD --checksum=sha256:73d17b8745007188c11c5d20420a60f8fbca8fae3d1633a354e73f3c78a825bf https://packages.wolfi.dev/os/aarch64/libedit-dev-3.1-r20.apk /tmp/meri-native-dev-repo/aarch64/libedit-dev-3.1-r20.apk
ADD --checksum=sha256:8c21a68b33b354e1710bd44308b268986d59fcb2c76ef09b2ee330ae86f0f213 https://packages.wolfi.dev/os/aarch64/libev-4.33-r14.apk /tmp/meri-native-dev-repo/aarch64/libev-4.33-r14.apk
ADD --checksum=sha256:abeeb0ffa21b3ca6175cb997d9919920a26a2f50aaa61116f03ed40b1cfd764f https://packages.wolfi.dev/os/aarch64/libexpat1-2.9.0-r0.apk /tmp/meri-native-dev-repo/aarch64/libexpat1-2.9.0-r0.apk
ADD --checksum=sha256:c782296bb6afa9c6e183ef51bc14367e55768ba2acdbc822fccc96ac82257220 https://packages.wolfi.dev/os/aarch64/libgcc-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libgcc-16.2.0-r2.apk
ADD --checksum=sha256:7831c1a233c51524151b736fe36f268fc49945f9563d5d85020728908f0be927 https://packages.wolfi.dev/os/aarch64/libgcrypt-1.12.4-r2.apk /tmp/meri-native-dev-repo/aarch64/libgcrypt-1.12.4-r2.apk
ADD --checksum=sha256:34c492411672a1c41cb4cec7b2fdc7ea601904e57184722279e7d849b0aac4be https://packages.wolfi.dev/os/aarch64/libgomp-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libgomp-16.2.0-r2.apk
ADD --checksum=sha256:a139291a6f58dd83c8669ba9757f26941f96d7edbaad88bbfb8f62a5c737613b https://packages.wolfi.dev/os/aarch64/libgpg-error-1.61-r6.apk /tmp/meri-native-dev-repo/aarch64/libgpg-error-1.61-r6.apk
ADD --checksum=sha256:c9489c1f009a75967b198bf30415637505ad85ec7d7afca74ee3e76c84335bd7 https://packages.wolfi.dev/os/aarch64/libidn2-2.3.8-r12.apk /tmp/meri-native-dev-repo/aarch64/libidn2-2.3.8-r12.apk
ADD --checksum=sha256:e5f31e389061015223f51503186e8f774c767175596769e91f30166a08e9a73f https://packages.wolfi.dev/os/aarch64/libldap-2.7-2.7.2-r0.apk /tmp/meri-native-dev-repo/aarch64/libldap-2.7-2.7.2-r0.apk
ADD --checksum=sha256:6ae70433df5da1339a1d76e34a1ed1a715f81b0cafa242674972cbfef9b7d709 https://packages.wolfi.dev/os/aarch64/liblz4-1-1.10.0-r11.apk /tmp/meri-native-dev-repo/aarch64/liblz4-1-1.10.0-r11.apk
ADD --checksum=sha256:1633e1cffe84476c70de08113687c462bfde6314d0b6331009abda003bae85a9 https://packages.wolfi.dev/os/aarch64/libmilter-dev-8.18.2-r5.apk /tmp/meri-native-dev-repo/aarch64/libmilter-dev-8.18.2-r5.apk
ADD --checksum=sha256:e210213dea283409610f842a816cde531a8e9990d437897b11cc01292c52929b https://packages.wolfi.dev/os/aarch64/libnghttp2-14-1.70.0-r7.apk /tmp/meri-native-dev-repo/aarch64/libnghttp2-14-1.70.0-r7.apk
ADD --checksum=sha256:313e59a428b17f811877c2366a515bb06327fd385c1935d8bf2c2919544ae693 https://packages.wolfi.dev/os/aarch64/libpcre2-16-0-10.49-r1.apk /tmp/meri-native-dev-repo/aarch64/libpcre2-16-0-10.49-r1.apk
ADD --checksum=sha256:50bd4a1105a56dee8351a70875966545a2d192b1bc8624be131c787bcd813332 https://packages.wolfi.dev/os/aarch64/libpcre2-32-0-10.49-r1.apk /tmp/meri-native-dev-repo/aarch64/libpcre2-32-0-10.49-r1.apk
ADD --checksum=sha256:951a1e197e06d20d19bfeaa71629cf5acc4f62174ae2802d071cb230b72b3d9b https://packages.wolfi.dev/os/aarch64/libpcre2-8-0-10.49-r1.apk /tmp/meri-native-dev-repo/aarch64/libpcre2-8-0-10.49-r1.apk
ADD --checksum=sha256:4eaf3a1c51e9efd68f7f02aaaf3d875c2479a488277a7fa16d40d96080fb426a https://packages.wolfi.dev/os/aarch64/libpcre2-posix-3-10.49-r1.apk /tmp/meri-native-dev-repo/aarch64/libpcre2-posix-3-10.49-r1.apk
ADD --checksum=sha256:eeac8fadc4a543c649d8162107f771d4ed71842585d90835ed100fd2b79ef77e https://packages.wolfi.dev/os/aarch64/libpsl-0.23.3-r4.apk /tmp/meri-native-dev-repo/aarch64/libpsl-0.23.3-r4.apk
ADD --checksum=sha256:c10e9a3060e23622552f2cda743ff1928c13f7742230d5b4d1fe781c54a6f8f2 https://packages.wolfi.dev/os/aarch64/libpsl-dev-0.23.3-r4.apk /tmp/meri-native-dev-repo/aarch64/libpsl-dev-0.23.3-r4.apk
ADD --checksum=sha256:ac602cb44cb8cda52879279a0df523e6e6ee3411094940e6dce22fe0c2b64810 https://packages.wolfi.dev/os/aarch64/libquadmath-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libquadmath-16.2.0-r2.apk
ADD --checksum=sha256:5ca1acf4f0606f603fcc1b73576c7a5877b575df06ed4798102697b46df86de5 https://packages.wolfi.dev/os/aarch64/librhash0-1.4.6-r8.apk /tmp/meri-native-dev-repo/aarch64/librhash0-1.4.6-r8.apk
ADD --checksum=sha256:a004dfb5d3a07f49e3e281947f64b434a4ee683c6c597ef191bb39f749eadacc https://packages.wolfi.dev/os/aarch64/libstdc++-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libstdc++-16.2.0-r2.apk
ADD --checksum=sha256:4b7377db7cc4e62ece5c721768c180937f9b099230c04b6c7c8726f07ecdbd5e https://packages.wolfi.dev/os/aarch64/libstdc++-dev-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libstdc++-dev-16.2.0-r2.apk
ADD --checksum=sha256:540cec75eefb0f6f384701b5995f48c27f13744940a477ed23d9e119b9faa6e8 https://packages.wolfi.dev/os/aarch64/libunistring-1.5-r0.apk /tmp/meri-native-dev-repo/aarch64/libunistring-1.5-r0.apk
ADD --checksum=sha256:d171cf3d7e817b2bc98c3e40801b7531f9af1196c9c123e05778bbfbb85ee977 https://packages.wolfi.dev/os/aarch64/libuv-1.53.0-r0.apk /tmp/meri-native-dev-repo/aarch64/libuv-1.53.0-r0.apk
ADD --checksum=sha256:864750d72131a29f2f383e53adad5a3e4d32f70ffb3aef6282c0276ccfa8693d https://packages.wolfi.dev/os/aarch64/libverto-0.3.2-r11.apk /tmp/meri-native-dev-repo/aarch64/libverto-0.3.2-r11.apk
ADD --checksum=sha256:9dfd2b4a72d35a1f2c146a968c2368d7cab51bc7ae7854e3dc61e8a98dfeb746 https://packages.wolfi.dev/os/aarch64/libxcrypt-4.5.2-r6.apk /tmp/meri-native-dev-repo/aarch64/libxcrypt-4.5.2-r6.apk
FROM ${RUNTIME_IMAGE} AS native-dev-repo-3
ADD --checksum=sha256:95675169d8ca9bec31a56f84468b5c5fe6e17c3b1a4e7361653e0b1ffe15a0db https://packages.wolfi.dev/os/aarch64/libxcrypt-dev-4.5.2-r6.apk /tmp/meri-native-dev-repo/aarch64/libxcrypt-dev-4.5.2-r6.apk
ADD --checksum=sha256:3c76a370da61fc26789b0ac533ed76e442c9849b57564336856c7e0d224e9c8f https://packages.wolfi.dev/os/aarch64/libxml2-16-2.15.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libxml2-16-2.15.4-r1.apk
ADD --checksum=sha256:96ffa5dad67ad7918480e81ea7340cdf0b7de148cff4f5e70a1e9e513f2a8f84 https://packages.wolfi.dev/os/aarch64/libxml2-dev-2.15.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libxml2-dev-2.15.4-r1.apk
ADD --checksum=sha256:8ae2c2ac0859e5a59c1cf771d5491dcdce9f7b6e373c808d5d99ccc7a40789b2 https://packages.wolfi.dev/os/aarch64/libzstd1-1.5.7-r12.apk /tmp/meri-native-dev-repo/aarch64/libzstd1-1.5.7-r12.apk
ADD --checksum=sha256:bad48891f6a2ddb0af2b59c455fde722c2cdcecc52404fa396e5db9fd493a7d2 https://packages.wolfi.dev/os/aarch64/linux-headers-7.3-r0.apk /tmp/meri-native-dev-repo/aarch64/linux-headers-7.3-r0.apk
ADD --checksum=sha256:505a662fa56ce38d47e7796d1232754481ca49a243c8442044df8aeda0bdb768 https://packages.wolfi.dev/os/aarch64/make-4.4.1-r15.apk /tmp/meri-native-dev-repo/aarch64/make-4.4.1-r15.apk
ADD --checksum=sha256:635e2c11382dc56b961e89d4f01f5e8c9433df211a79775661dcfffff717c2d6 https://packages.wolfi.dev/os/aarch64/mpc-1.4.1-r3.apk /tmp/meri-native-dev-repo/aarch64/mpc-1.4.1-r3.apk
ADD --checksum=sha256:3dd588019e7b85a5c2061adf0cb4ed87d8591f38163a4f5ac085834000e0db13 https://packages.wolfi.dev/os/aarch64/mpfr-4.2.2-r5.apk /tmp/meri-native-dev-repo/aarch64/mpfr-4.2.2-r5.apk
ADD --checksum=sha256:ba996028cc4f3e1b4e4f42684d051257304ca065b7bd4fa20c5ee78f8b44ecb4 https://packages.wolfi.dev/os/aarch64/ncurses-6.6.20261024-r0.apk /tmp/meri-native-dev-repo/aarch64/ncurses-6.6.20261024-r0.apk
ADD --checksum=sha256:c8d7c18b7a9b9538e705a82ef037b08587b68271dd6d2b47c9f30b335b68b59b https://packages.wolfi.dev/os/aarch64/ncurses-dev-6.6.20261024-r0.apk /tmp/meri-native-dev-repo/aarch64/ncurses-dev-6.6.20261024-r0.apk
ADD --checksum=sha256:bca7075b9f5eaf58f1e92cd26c537f75ffe82a3b1d6663e18085d810002da423 https://packages.wolfi.dev/os/aarch64/nghttp2-1.70.0-r7.apk /tmp/meri-native-dev-repo/aarch64/nghttp2-1.70.0-r7.apk
ADD --checksum=sha256:7bb2cefdf22cd4f52ae86af39854d1dffda8fdb0de77c0527b40fe1911ce5823 https://packages.wolfi.dev/os/aarch64/nghttp2-dev-1.70.0-r7.apk /tmp/meri-native-dev-repo/aarch64/nghttp2-dev-1.70.0-r7.apk
ADD --checksum=sha256:b5064f8ff42f91e2410812a7cc0e6278043132c0ef79ea6480f4c354bdd248a7 https://packages.wolfi.dev/os/aarch64/nghttp3-1.18.0-r3.apk /tmp/meri-native-dev-repo/aarch64/nghttp3-1.18.0-r3.apk
ADD --checksum=sha256:c5c7b02654047fceacfc5e8fc7b3b99c8a2622a807bae880aacdbfc46c76f336 https://packages.wolfi.dev/os/aarch64/ngtcp2-1.25.0-r7.apk /tmp/meri-native-dev-repo/aarch64/ngtcp2-1.25.0-r7.apk
ADD --checksum=sha256:d5efa0369a3e1d4c8dbaab613075949fdfd58b4b654180b9f86ba4fb87f0d411 https://packages.wolfi.dev/os/aarch64/npth-libs-1.8-r16.apk /tmp/meri-native-dev-repo/aarch64/npth-libs-1.8-r16.apk
ADD --checksum=sha256:afbcc8b08af58a664a69c6e4bf60624bebdc2af3d2d5cf540c5826ebe040cf70 https://packages.wolfi.dev/os/aarch64/openssf-compiler-options-20250904-r11.apk /tmp/meri-native-dev-repo/aarch64/openssf-compiler-options-20250904-r11.apk
ADD --checksum=sha256:bbf9738a1960100008bcc6aba188ed7ce4a84c7873ddeb4ba5b19a2dda30dc1c https://packages.wolfi.dev/os/aarch64/openssl-3.6-libcrypto-3.6.5-r6.apk /tmp/meri-native-dev-repo/aarch64/openssl-3.6-libcrypto-3.6.5-r6.apk
ADD --checksum=sha256:694c0e06540eed0d944cfd6c5fc11b247e62f183b989fd615fddf79b72e6247d https://packages.wolfi.dev/os/aarch64/openssl-3.6-libssl-3.6.5-r6.apk /tmp/meri-native-dev-repo/aarch64/openssl-3.6-libssl-3.6.5-r6.apk
ADD --checksum=sha256:326f89668c2ebaee7e71e7ae48a4df6fe08936a6fcb35bb222ac0a733247bd91 https://packages.wolfi.dev/os/aarch64/openssl-4.0-dev-4.0.3-r8.apk /tmp/meri-native-dev-repo/aarch64/openssl-4.0-dev-4.0.3-r8.apk
ADD --checksum=sha256:8a509f24f834724ea1927d5a37cd6e8fba5d7c98d0ea8fdea7689b27852e05fc https://packages.wolfi.dev/os/aarch64/openssl-4.0-libcrypto-4.0.3-r8.apk /tmp/meri-native-dev-repo/aarch64/openssl-4.0-libcrypto-4.0.3-r8.apk
ADD --checksum=sha256:0dd48c2a58466c6787d0df2ff2254623c8f470faa6d986975a4c123ef04c6a9c https://packages.wolfi.dev/os/aarch64/openssl-4.0-libssl-4.0.3-r8.apk /tmp/meri-native-dev-repo/aarch64/openssl-4.0-libssl-4.0.3-r8.apk
ADD --checksum=sha256:22313fca19b8143db5d239bd14c5251416a2e35ba7418b23b64ece7701bc9785 https://packages.wolfi.dev/os/aarch64/openssl-provider-legacy-allowed-4.1.0-r0.apk /tmp/meri-native-dev-repo/aarch64/openssl-provider-legacy-allowed-4.1.0-r0.apk
ADD --checksum=sha256:20ea3fe3b573f2671acb4461d479e0752d46c478b97c4bf85c39e9db8e797219 https://packages.wolfi.dev/os/aarch64/pcre2-dev-10.49-r1.apk /tmp/meri-native-dev-repo/aarch64/pcre2-dev-10.49-r1.apk
ADD --checksum=sha256:b8f21e05154d0a4513e2d7e538b1335b33c2a10086ca8968371846e1000555b3 https://packages.wolfi.dev/os/aarch64/pkgconf-3.0.10-r2.apk /tmp/meri-native-dev-repo/aarch64/pkgconf-3.0.10-r2.apk
ADD --checksum=sha256:1276b118e8e574204601706d56e0381210c4c9c4c1393ca793add9361e4b8810 https://packages.wolfi.dev/os/aarch64/posix-cc-wrappers-2-r10.apk /tmp/meri-native-dev-repo/aarch64/posix-cc-wrappers-2-r10.apk
ADD --checksum=sha256:8d4ae6286e3fdc2b50fdd911fe1aa474c771c5708184e721e2255283ec6d7e4e https://packages.wolfi.dev/os/aarch64/readline-8.3-r3.apk /tmp/meri-native-dev-repo/aarch64/readline-8.3-r3.apk
ADD --checksum=sha256:158a9e84fd8b3addfca5f3abfb02b754012d6e1d173d4467627d67541c5eafae https://packages.wolfi.dev/os/aarch64/sqlite-libs-3.54.1-r0.apk /tmp/meri-native-dev-repo/aarch64/sqlite-libs-3.54.1-r0.apk
ADD --checksum=sha256:2a6815ada2973deba196e24f4406fcd2619f6a070e693013563530705254a2b8 https://packages.wolfi.dev/os/aarch64/wolfi-baselayout-20230201-r30.apk /tmp/meri-native-dev-repo/aarch64/wolfi-baselayout-20230201-r30.apk
ADD --checksum=sha256:d2c12615a9601d34f1500a782c38177d18417c576fe7b145e4e88b0165681874 https://packages.wolfi.dev/os/aarch64/xz-5.8.4-r0.apk /tmp/meri-native-dev-repo/aarch64/xz-5.8.4-r0.apk
ADD --checksum=sha256:2afd54eedac80d32f8f89fedc7f2ffd68343cbfca7bd75eee475799b1dbbc300 https://packages.wolfi.dev/os/aarch64/xz-dev-5.8.4-r0.apk /tmp/meri-native-dev-repo/aarch64/xz-dev-5.8.4-r0.apk
ADD --checksum=sha256:94eeec2403d0a8515362ba8ce6ce53d16f905d0b4f69ecf710d34db40cc1381a https://packages.wolfi.dev/os/aarch64/zlib-1.3.2.1_rc20260921-r1.apk /tmp/meri-native-dev-repo/aarch64/zlib-1.3.2.1_rc20260921-r1.apk
ADD --checksum=sha256:4ceab8cc43bf77871362a2e01560b721013249bc86bf633d99778a3ff8c865ff https://packages.wolfi.dev/os/aarch64/zlib-dev-1.3.2.1_rc20260921-r1.apk /tmp/meri-native-dev-repo/aarch64/zlib-dev-1.3.2.1_rc20260921-r1.apk
FROM ${RUNTIME_IMAGE} AS native-dev-repo-4
ADD --checksum=sha256:a2e49f78f2e9790df467bd491e514a4e0ea301bd4bbbeaac8299bfeefe698a33 https://packages.wolfi.dev/os/aarch64/e2fsprogs-dev-1.47.4-r5.apk /tmp/meri-native-dev-repo/aarch64/e2fsprogs-dev-1.47.4-r5.apk
ADD --checksum=sha256:c450f4e058eb6e800fea796ff59233d7289ccdf0f9ed5b3c501dd63c7eacbf26 https://packages.wolfi.dev/os/aarch64/e2fsprogs-libs-1.47.4-r5.apk /tmp/meri-native-dev-repo/aarch64/e2fsprogs-libs-1.47.4-r5.apk
ADD --checksum=sha256:55010655a41ac8cfe80c701c398a150fbdbf231306c49581def5739032e90330 https://packages.wolfi.dev/os/aarch64/fstrim-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/fstrim-2.42.4-r1.apk
ADD --checksum=sha256:4a00f1747ade96fbb4e7d157966b99400dd1b6259c975b7ec532eeb415d23f5b https://packages.wolfi.dev/os/aarch64/krb5-dev-1.22.2-r5.apk /tmp/meri-native-dev-repo/aarch64/krb5-dev-1.22.2-r5.apk
ADD --checksum=sha256:3b8e2ff676008d11648125cf3a4477a58661f34c5487d3f2eaa0875614e48344 https://packages.wolfi.dev/os/aarch64/krb5-server-ldap-1.22.2-r5.apk /tmp/meri-native-dev-repo/aarch64/krb5-server-ldap-1.22.2-r5.apk
ADD --checksum=sha256:59c50816e05ff5e3980d4f23516208b30f03df4e6ec3461da3e2445206ba2f2a https://packages.wolfi.dev/os/aarch64/libatomic-16.2.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libatomic-16.2.0-r2.apk
ADD --checksum=sha256:7f732012769f0eaa784c68484d7b1b0bb4bad9000b1837c28719b5cb82377077 https://packages.wolfi.dev/os/aarch64/libblkid-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libblkid-2.42.4-r1.apk
ADD --checksum=sha256:cd768fc4b4922388c88b5bfeae90726837e7938f64760afcc215801b148002dd https://packages.wolfi.dev/os/aarch64/libevent-2.1.13-r3.apk /tmp/meri-native-dev-repo/aarch64/libevent-2.1.13-r3.apk
ADD --checksum=sha256:3cdc633490edf569e0c1e18124b3dd26e8b916fb1c071e6a04d99b39d8d374f7 https://packages.wolfi.dev/os/aarch64/libfdisk-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libfdisk-2.42.4-r1.apk
ADD --checksum=sha256:df5cab585fd544ce671305dc8b8187bb1ed0c8ac016e995dd129d8d6dd9c556b https://packages.wolfi.dev/os/aarch64/libffi-3.8.0-r2.apk /tmp/meri-native-dev-repo/aarch64/libffi-3.8.0-r2.apk
ADD --checksum=sha256:9087f8569a511c92ba766c56d5b28d505ace24d8ed2fb8b90b6ba15770618630 https://packages.wolfi.dev/os/aarch64/libidn2-dev-2.3.8-r12.apk /tmp/meri-native-dev-repo/aarch64/libidn2-dev-2.3.8-r12.apk
ADD --checksum=sha256:3cafd792198fb80bdf34a78c818e9f5b04f447847611a32394d1c898f8c601f8 https://packages.wolfi.dev/os/aarch64/libldap-2.6-2.6.14-r0.apk /tmp/meri-native-dev-repo/aarch64/libldap-2.6-2.6.14-r0.apk
ADD --checksum=sha256:96419166eb4979516abcd40cd1bfce94b8f20a41c7ab7712492a0861e0aeff3a https://packages.wolfi.dev/os/aarch64/libmount-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libmount-2.42.4-r1.apk
ADD --checksum=sha256:6c96ee48b1ed094dd58598f3df0b2ae678a78d343b3d6f6cf25e6a59a685eea9 https://packages.wolfi.dev/os/aarch64/libselinux-3.11-r2.apk /tmp/meri-native-dev-repo/aarch64/libselinux-3.11-r2.apk
ADD --checksum=sha256:9ec2b81b2a96d0e9e730746fbb66eec5c7d4e424e7913fd08a671396426f2abe https://packages.wolfi.dev/os/aarch64/libselinux-dev-3.11-r2.apk /tmp/meri-native-dev-repo/aarch64/libselinux-dev-3.11-r2.apk
ADD --checksum=sha256:d44df089fbd2260bba1ecc62e6cff0fa7f22382a86718fdb3f79e0f9086a92ae https://packages.wolfi.dev/os/aarch64/libsepol-3.11-r3.apk /tmp/meri-native-dev-repo/aarch64/libsepol-3.11-r3.apk
ADD --checksum=sha256:d0234724e0763e8aa9ec5baa64dc3e964a7da5ee697b8b7b7dfc50c4bd636861 https://packages.wolfi.dev/os/aarch64/libsepol-dev-3.11-r3.apk /tmp/meri-native-dev-repo/aarch64/libsepol-dev-3.11-r3.apk
ADD --checksum=sha256:5213a123c63fa2cac483c5de6ba91418722cc95f791378f2d48f1190ab0eac65 https://packages.wolfi.dev/os/aarch64/libsmartcols-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libsmartcols-2.42.4-r1.apk
ADD --checksum=sha256:63ad89463dd6cbb0c682bef6aabdc9896e2708cb42c05bcc33d6bf0dd5ed3bab https://packages.wolfi.dev/os/aarch64/libuuid-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libuuid-2.42.4-r1.apk
ADD --checksum=sha256:5bed808ee162cc20ba04f5f0b86749da62643ca8e72a22139162529d10a2d666 https://packages.wolfi.dev/os/aarch64/libverto-dev-0.3.2-r11.apk /tmp/meri-native-dev-repo/aarch64/libverto-dev-0.3.2-r11.apk
ADD --checksum=sha256:7f1374be73df642f7ea38a03b3e8f5ccbc2449e6d143097314e00fee73f2ccbd https://packages.wolfi.dev/os/aarch64/libverto-glib-0.3.2-r11.apk /tmp/meri-native-dev-repo/aarch64/libverto-glib-0.3.2-r11.apk
ADD --checksum=sha256:72774559b55fe81604591f5c11b7ba6bc25fe12f1d34b075b4b6e04ed6748222 https://packages.wolfi.dev/os/aarch64/libverto-libev-0.3.2-r11.apk /tmp/meri-native-dev-repo/aarch64/libverto-libev-0.3.2-r11.apk
ADD --checksum=sha256:48eb1ea91133ae7bc0f71f994cde5acdda099c9320344ec2cbad853b6f0a7de9 https://packages.wolfi.dev/os/aarch64/libverto-libevent-0.3.2-r11.apk /tmp/meri-native-dev-repo/aarch64/libverto-libevent-0.3.2-r11.apk
ADD --checksum=sha256:bcff729776b35ec947672206e228292a8e483bba1ec33c3cfb4d235383f0ad00 https://packages.wolfi.dev/os/aarch64/libxml2-utils-2.15.4-r1.apk /tmp/meri-native-dev-repo/aarch64/libxml2-utils-2.15.4-r1.apk
ADD --checksum=sha256:96fad2b9fcde9c423a80ce94979b19b501ea3ca464682248b226c2f9e7aaeb92 https://packages.wolfi.dev/os/aarch64/linux-pam-1.7.3-r1.apk /tmp/meri-native-dev-repo/aarch64/linux-pam-1.7.3-r1.apk
ADD --checksum=sha256:a01c937f77c6d6e3f62fe67ef6a86f663409fdadf8ae18733d1227ec469814c7 https://packages.wolfi.dev/os/aarch64/ncurses-terminfo-base-6.6.20261024-r0.apk /tmp/meri-native-dev-repo/aarch64/ncurses-terminfo-base-6.6.20261024-r0.apk
ADD --checksum=sha256:5a4155752fcfccad560411614c23a5023acc80b3e35baa87c22c2eb92f624ff6 https://packages.wolfi.dev/os/aarch64/nghttp3-dev-1.18.0-r3.apk /tmp/meri-native-dev-repo/aarch64/nghttp3-dev-1.18.0-r3.apk
ADD --checksum=sha256:a4bc89b1363a9107a7b0f4177c9e81ef7aa68da7728e71b0762ee284a56209a7 https://packages.wolfi.dev/os/aarch64/ngtcp2-dev-1.25.0-r7.apk /tmp/meri-native-dev-repo/aarch64/ngtcp2-dev-1.25.0-r7.apk
ADD --checksum=sha256:803e558008fb6525528b5a72e5d66b63f3f0d6e27305ca8d6aad9eda15e74f9e https://packages.wolfi.dev/os/aarch64/npth-1.8-r11.apk /tmp/meri-native-dev-repo/aarch64/npth-1.8-r11.apk
ADD --checksum=sha256:e26afd62c9b1c96716d4270288bb636a434eae3d6c84425f06f233b3a5ac4449 https://packages.wolfi.dev/os/aarch64/perl-5.44.0-r4.apk /tmp/meri-native-dev-repo/aarch64/perl-5.44.0-r4.apk
ADD --checksum=sha256:57bd0a46f5698266ca1b11243369068da735587e5b023aa3dfa9076ef4dc767b https://packages.wolfi.dev/os/aarch64/sqlite-3.54.1-r0.apk /tmp/meri-native-dev-repo/aarch64/sqlite-3.54.1-r0.apk
ADD --checksum=sha256:46a3aba6c36df74a2e9d8dffec047ff423a3699e0d0160f05a8fd43c64829748 https://packages.wolfi.dev/os/aarch64/sqlite-dev-3.54.1-r0.apk /tmp/meri-native-dev-repo/aarch64/sqlite-dev-3.54.1-r0.apk
ADD --checksum=sha256:c3e162065d493add318143b5b8c24e650a5c80da72abdf7d60784e743ea1713f https://packages.wolfi.dev/os/aarch64/util-linux-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/util-linux-2.42.4-r1.apk
ADD --checksum=sha256:6bd1942866fefc242ddc84cc2626564afebdfb1e4ae1d29e7ee05764ad8ea0b3 https://packages.wolfi.dev/os/aarch64/util-linux-dev-2.42.4-r1.apk /tmp/meri-native-dev-repo/aarch64/util-linux-dev-2.42.4-r1.apk
ADD --checksum=sha256:f9877cd621c1941636c7e99972fdb3d1bd66fa1fc0a736a9a4d3c7a521a7a14b https://packages.wolfi.dev/os/aarch64/glib-2.90.1-r0.apk /tmp/meri-native-dev-repo/aarch64/glib-2.90.1-r0.apk
FROM ${RUNTIME_IMAGE} AS native-source-inputs
ADD --checksum=sha256:1af1117a228f1b5bc7fa91a0dabc37848a99e7d25188e9be8043332ce721dfd3 https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.tar.gz /tmp/meri-native-source/clamav-1.5.4.tar.gz
ADD --checksum=sha256:8acf5816c3c9dc8b02a2e11f93d90d37b25845a0481e16873454df4a30a375c0 https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.tar.gz.sig /tmp/meri-native-source/clamav-1.5.4.tar.gz.sig
ADD --checksum=sha256:5bfca75f112f04b89cd992f5f925018e8dfc28e0e7f6e33f6a4c33ed9e29d911 https://raw.githubusercontent.com/Cisco-Talos/clamav-documentation/main/src/manual/cisco-talos.gpg /tmp/meri-native-source/cisco-talos.gpg
ADD --checksum=sha256:e54b09a439647e006b4831eec9785cbaaf3e07ab371c3a6ee6a68e1bdb9fbc6b https://static.rust-lang.org/rust-key.gpg.ascii /tmp/meri-native-source/rust-key.gpg.ascii
ADD --checksum=sha256:a48fb1e853be56ce9b8e2751f5464dbd5e16440cd81e237920f3a5e7e806333e https://static.rust-lang.org/dist/2026-10-15/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz /tmp/meri-native-source/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz
ADD --checksum=sha256:56b30250065ff8b7699689ec34d34074c6a51f5c8b5a8cc6feb098b3115a3256 https://static.rust-lang.org/dist/2026-10-15/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz.asc /tmp/meri-native-source/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz.asc
COPY infra/product-preview/native-clamav-keys/cisco-talos-keyring.gpg /tmp/meri-native-source/cisco-talos-keyring.gpg
COPY infra/product-preview/native-clamav-keys/rust-release-keyring.gpg /tmp/meri-native-source/rust-release-keyring.gpg
FROM ${RUNTIME_IMAGE} AS native-dev-repository
COPY infra/product-preview/native-apk-index/aarch64-APKINDEX-5c84e4b835a811c1624d9692f011df3de446c8011be4dedaabf6f3dbf41ec536.tar.gz /tmp/meri-native-dev-repo/aarch64/APKINDEX.tar.gz
COPY --from=native-dev-repo-1 /tmp/meri-native-dev-repo /tmp/meri-native-dev-repo
COPY --from=native-dev-repo-2 /tmp/meri-native-dev-repo /tmp/meri-native-dev-repo
COPY --from=native-dev-repo-3 /tmp/meri-native-dev-repo /tmp/meri-native-dev-repo
COPY --from=native-dev-repo-4 /tmp/meri-native-dev-repo /tmp/meri-native-dev-repo
COPY --from=native-source-inputs /tmp/meri-native-source /tmp/meri-native-source
# Build-only assembly stage. It stages the retained vendor-signed index verbatim beside the four staging
# partitions, assembling exactly the one local apk repository the three native layers read. It is deliberately
# NOT the final stage, so none of these bytes become layers of the exported image: the runtime stage below
# reaches this repository through a read-only bind mount held for the length of each install RUN. COPYing the
# same repository into the runtime stage instead made it image content - 491,079,152 B of staged archives (the
# lock's own bytes total over all 190 members) plus the 7,048,290 B index - and build c7c101e2 completed all 22
# runtime steps and was rejected by the retained post-build gate alone, its image measuring 3,396,475,702 B
# against the 3,221,225,472 B (3 GiB) ceiling. Staging the bytes here keeps every ADD --checksum instruction,
# URL, checksum, order and partition unchanged while the payload stays out of the exported image.
FROM ${RUNTIME_IMAGE} AS native-repository
COPY infra/product-preview/native-apk-index/aarch64-APKINDEX-5c84e4b835a811c1624d9692f011df3de446c8011be4dedaabf6f3dbf41ec536.tar.gz /tmp/meri-native-repo/aarch64/APKINDEX.tar.gz
COPY --from=native-repo-1 /tmp/meri-native-repo /tmp/meri-native-repo
COPY --from=native-repo-2 /tmp/meri-native-repo /tmp/meri-native-repo
COPY --from=native-repo-3 /tmp/meri-native-repo /tmp/meri-native-repo
COPY --from=native-repo-4 /tmp/meri-native-repo /tmp/meri-native-repo

# The compiler stage itself. It installs the pinned development closure offline from the assembled staging repository
# (same signed index, no network, no untrusted-file exception), authenticates the staged source bytes against the
# pinned Cisco Talos key and the staged Rust toolchain against the Rust release key, builds ClamAV 1.5.4 with its
# mandatory Rust component from the vendored crate tree inside the release asset, runs the project's own unit tests,
# and installs the payload into a staging prefix whose every installed file is recorded by sha256. No image layer
# carries the toolchain, the headers or the build tree, and nothing outside this stage is compiled from source.
# RUN --network=none below enforces that offline execution for the whole stage, so the configure/cargo/ctest
# sequence cannot reach the network even if a fetch were attempted: the vendored crate tree inside the release
# asset and FindRust's offline mode are the mechanism, and this guard is what makes the claim enforced rather
# than merely available. It is the same guard the runtime pip install and the certificate RUN already use.
# The upstream source requires an interpreter here: clamav-1.5.4/CMakeLists.txt 219-231 asks for
# find_package(Libcheck REQUIRED) and find_package(Python3 REQUIRED) with ENABLE_TESTS=ON, and 256-277 runs the
# unit-test input generators with ${Python3_EXECUTABLE} at build time and requires `${Python3_EXECUTABLE} -m
# unittest --help` to exit 0, because this stage carries no pytest. The pinned 136-archive development closure was
# resolved for the toolchain and carries no interpreter, and the interpreter the exported runtime stage installs
# lives in a later stage, so it cannot supply this one. The stage therefore reads the retained runtime staging set
# - the same vendor-signed index and the same authenticated archives the runtime stage already installs python-3.13
# from - through a read-only mount at its own path, installs the interpreter and its standard library from that one
# repository with no configured repository and no network, and asserts the version and the imports the upstream
# suite and input generators use. The development closure's own version assertion loop still runs after that
# install, so the interpreter cannot silently move a pinned build dependency.
FROM ${RUNTIME_IMAGE} AS clamav-source-build
RUN --network=none \
    --mount=type=bind,from=native-dev-repository,source=tmp/meri-native-dev-repo,target=/tmp/meri-native-dev-repo,readonly \
    --mount=type=bind,from=native-dev-repository,source=tmp/meri-native-source,target=/tmp/meri-native-source,readonly \
    --mount=type=bind,from=native-repository,source=tmp/meri-native-repo,target=/tmp/meri-native-runtime-repo,readonly \
    apk --version && \
    apk add --no-cache --no-network --repository /tmp/meri-native-dev-repo --repositories-file /dev/null --update-cache \
      gcc=16.2.0-r2 libgcc=16.2.0-r2 binutils=2.47-r2 make=4.4.1-r15 cmake=4.4.3-r0 pkgconf=3.0.10-r2 bash=5.3-r14 xz=5.8.4-r0 \
      libstdc++-dev=16.2.0-r2 libmilter-dev=8.18.2-r5 gpgv=2.4.9-r12 \
      glibc-2.44-dev=2.44-r10 glibc-2.44=2.44-r10 glibc-2.44-locale-posix=2.44-r10 ld-linux-2.44=2.44-r10 libcrypt1-2.44=2.44-r10 \
      zlib=1.3.2.1_rc20260921-r1 zlib-dev=1.3.2.1_rc20260921-r1 bzip2-dev=1.0.8-r28 libxml2-dev=2.15.4-r1 pcre2-dev=10.49-r1 \
      openssl-4.0-dev=4.0.3-r8 json-c-dev=0.19-r2 curl-dev=8.23.0-r2 ncurses-dev=6.6.20261024-r0 \
      check-dev=0.15.2-r10 check=0.15.2-r10 linux-headers=7.3-r0 && \
    gcc --version | head -1 && cmake --version | head -1 && make --version | head -1 && pkg-config --version && \
    apk add --no-cache --no-network --repository /tmp/meri-native-runtime-repo --repositories-file /dev/null --update-cache \
      python-3.13=3.13.16_git20261016-r2 python-3.13-base=3.13.16_git20261016-r2 && \
    for pkg in python-3.13-3.13.16_git20261016-r2 python-3.13-base-3.13.16_git20261016-r2; do \
      apk info -v | grep -qx "$pkg" || { echo "unexpected native interpreter package $pkg"; exit 1; }; done && \
    python3.13 --version && \
    python3.13 -c 'import sys; assert sys.version_info[:3] == (3, 13, 16), sys.version; print("interpreter", sys.version)' && \
    python3.13 -m unittest --help > /dev/null && \
    python3.13 -c 'import argparse, errno, functools, getpass, hashlib, http.server, logging, multiprocessing, os, pathlib, platform, random, re, shutil, signal, socket, socketserver, struct, subprocess, sys, tempfile, threading, time, typing, unittest, unittest.mock, zipfile, zlib' && \
    for p in gcc-16.2.0-r2 binutils-2.47-r2 make-4.4.1-r15 cmake-4.4.3-r0 pkgconf-3.0.10-r2 bash-5.3-r14 xz-5.8.4-r0 libstdc++-dev-16.2.0-r2 libmilter-dev-8.18.2-r5 gpgv-2.4.9-r12 glibc-2.44-dev-2.44-r10 glibc-2.44-2.44-r10 zlib-dev-1.3.2.1_rc20260921-r1 bzip2-dev-1.0.8-r28 libxml2-dev-2.15.4-r1 pcre2-dev-10.49-r1 openssl-4.0-dev-4.0.3-r8 json-c-dev-0.19-r2 curl-dev-8.23.0-r2 ncurses-dev-6.6.20261024-r0 check-dev-0.15.2-r10 check-0.15.2-r10 linux-headers-7.3-r0; do \
      apk info -v | grep -qx "$p" || { echo "unexpected native development dependency $p"; exit 1; }; done && \
    if apk info -v | grep -qx glibc-dev-2.43-r13; then \
      echo "the legacy glibc-dev 2.43 family was installed beside the pinned 2.44 family"; exit 1; fi && \
    echo "1af1117a228f1b5bc7fa91a0dabc37848a99e7d25188e9be8043332ce721dfd3  /tmp/meri-native-source/clamav-1.5.4.tar.gz" > /tmp/clamav.sha256 && \
    echo "8caffabffbc85f12e145c9bb69b704369d7731c98d751ac123edc130c00d81b5  /tmp/meri-native-source/cisco-talos-keyring.gpg" > /tmp/keys.sha256 && \
    echo "97e694f136f8c106e8f94fdadf593d2fc10de3ff3f558536c41469aa5be7f635  /tmp/meri-native-source/rust-release-keyring.gpg" >> /tmp/keys.sha256 && \
    sha256sum -c /tmp/clamav.sha256 && \
    sha256sum -c /tmp/keys.sha256 && \
    gpgv --keyring /tmp/meri-native-source/cisco-talos-keyring.gpg --status-fd 3 \
      /tmp/meri-native-source/clamav-1.5.4.tar.gz.sig /tmp/meri-native-source/clamav-1.5.4.tar.gz \
      3> /tmp/clamav-vendor.status && \
    grep -q "VALIDSIG 5BADCA2665EF59DCF8A23D8B707F0DB480836771" /tmp/clamav-vendor.status && \
    gpgv --keyring /tmp/meri-native-source/rust-release-keyring.gpg --status-fd 3 \
      /tmp/meri-native-source/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz.asc /tmp/meri-native-source/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz 3> /tmp/rust-vendor.status && \
    grep -q "VALIDSIG 108F66205EAEB0AAA8DD5E1C85AB96E6FA1BE5FE" /tmp/rust-vendor.status && \
    echo "a48fb1e853be56ce9b8e2751f5464dbd5e16440cd81e237920f3a5e7e806333e  /tmp/meri-native-source/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz" | sha256sum -c - && \
    mkdir -p /tmp/rust-extract /opt/rust && tar -xJf /tmp/meri-native-source/rust-1.99.1-aarch64-unknown-linux-gnu.tar.xz -C /tmp/rust-extract --strip-components=1 && \
    /tmp/rust-extract/install.sh --prefix=/opt/rust --disable-ldconfig \
      --without=rust-docs,rust-docs-json,rust-analysis >/dev/null && \
    export PATH=/opt/rust/bin:$PATH && rustc --version && cargo --version && \
    mkdir -p /usr/src && tar -xzf /tmp/meri-native-source/clamav-1.5.4.tar.gz -C /usr/src && \
    cmake -S /usr/src/clamav-1.5.4 -B /tmp/clamav-build \
      -D CMAKE_BUILD_TYPE=RelWithDebInfo -D CMAKE_INSTALL_PREFIX=/usr -D CMAKE_INSTALL_SYSCONFDIR=/etc \
      -D ENABLE_APP=ON -D ENABLE_MILTER=ON -D ENABLE_CLAMONACC=ON -D ENABLE_UNRAR=ON -D ENABLE_TESTS=ON \
      -D ENABLE_JSON_SHARED=ON -D ENABLE_EXTERNAL_MSPACK=OFF -D ENABLE_SYSTEMD=OFF -D ENABLE_MAN_PAGES=OFF \
      -D ENABLE_EXAMPLES=OFF -D ENABLE_DOXYGEN=OFF -D ENABLE_LIBCLAMAV_ONLY=OFF -D ENABLE_STATIC_LIB=OFF \
      -D ENABLE_SHARED_LIB=ON -D RUST_COMPILER_TARGET=aarch64-unknown-linux-gnu && \
    cmake --build /tmp/clamav-build --parallel "$(nproc)" && \
    ctest --test-dir /tmp/clamav-build --output-on-failure && \
    DESTDIR=/tmp/meri-clamav-out cmake --install /tmp/clamav-build && \
    mkdir -p /tmp/meri-clamav-out/usr/share/meri && \
    printf '%s\n' '{"builtFrom":"the authenticated upstream release asset, not a distribution package","component":"clamav","coverage":"infra/product-preview/clamav-source-advisories.json with the check in infra/product-preview/clamav_component_coverage.py","detachedSignatureSha256":"8acf5816c3c9dc8b02a2e11f93d90d37b25845a0481e16873454df4a30a375c0","detachedSignatureUrl":"https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.tar.gz.sig","distributionPackagesRemoved":["clamav-1.5-scanner=1.5.2-r0","clamav-1.5-freshclam=1.5.2-r0","clamav-1.5=1.5.2-r7"],"installedBy":"apps/runtime/Dockerfile, stage clamav-source-build, copied into the runtime stage from /tmp/meri-clamav-out","installedInventory":"/usr/share/meri/clamav-component-inventory.txt (sha256 of the installed executables in usr/bin and usr/sbin and of the ClamAV and freshclam shared libraries in usr/lib: the payload'\''s executable and shared-library surface, not every file the image carries; re-checked against the installed bytes in the runtime stage and verified again by the image build probe)","installedInventorySha256":"INSTALLED-INVENTORY-SHA256-PLACEHOLDER","installedInventoryCovers":"usr/bin/*, usr/sbin/*, usr/lib/libclam*.so*, usr/lib/libfreshclam*.so*","libraryRelationships":"built with ENABLE_SHARED_LIB=ON and ENABLE_STATIC_LIB=OFF, so the payload ships shared libraries only: the installed tools load libclamav and libfreshclam from /usr/lib at runtime, and libclamav links the pinned closure'\''s zlib, openssl, libxml2, pcre2, bzip2 and json-c as the image provides them. Presence and version are asserted in the runtime stage; linkage and ABI remain unverified until a real ARM build.","coverageBinding":"the image build probe in infra/product-preview/image-build.sh executes python3.13 /usr/share/meri/clamav_component_coverage.py --bind against this image'\''s own clamscan, this inventory and this provenance, and fails the build when any of them disagree","qualification":"built, installed, probed and scanned image state is unproven until a separately allocated ARM build, probe and scan","signingKeyFingerprint":"5BADCA2665EF59DCF8A23D8B707F0DB480836771","signingKeyUrl":"https://raw.githubusercontent.com/Cisco-Talos/clamav-documentation/main/src/manual/cisco-talos.gpg","upstreamReleased":"2026-08-07","upstreamSha256":"1af1117a228f1b5bc7fa91a0dabc37848a99e7d25188e9be8043332ce721dfd3","upstreamUrl":"https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.tar.gz","upstreamVersion":"1.5.4"}' > /tmp/meri-clamav-out/usr/share/meri/clamav-component-provenance.json && \
    ( cd /tmp/meri-clamav-out && { find usr/bin usr/sbin -type f -exec sha256sum {} + ; \
        find usr/lib -maxdepth 1 -type f \( -name 'libclam*' -o -name 'libfreshclam*' \) -exec sha256sum {} + ; } | sort -k2 ) \
      > /tmp/meri-clamav-out/usr/share/meri/clamav-component-inventory.txt && \
    grep -q ' usr/lib/libclamav\.so' /tmp/meri-clamav-out/usr/share/meri/clamav-component-inventory.txt && \
    grep -q ' usr/lib/libfreshclam\.so' /tmp/meri-clamav-out/usr/share/meri/clamav-component-inventory.txt && \
    sed -i "s/INSTALLED-INVENTORY-SHA256-PLACEHOLDER/$(sha256sum /tmp/meri-clamav-out/usr/share/meri/clamav-component-inventory.txt | cut -d' ' -f1)/" \
      /tmp/meri-clamav-out/usr/share/meri/clamav-component-provenance.json && \
    grep -q '"installedInventorySha256":"[0-9a-f]\{64\}"' /tmp/meri-clamav-out/usr/share/meri/clamav-component-provenance.json && \
    wc -l /tmp/meri-clamav-out/usr/share/meri/clamav-component-inventory.txt

# The exported stage. Each native install RUN below mounts that assembled repository read-only, so apk reads
# exactly the bytes those ADD --checksum instructions verified, from one local repository, with no network, and
# the final image keeps only what apk installed.
FROM ${RUNTIME_IMAGE} AS runtime
USER root
WORKDIR /opt/meri
# apk owns the native dependencies and admits every archive through the retained vendor-signed index staged below.
# This layer pins the renderer's C++ runtime
# at libstdc++/libatomic 16.2.0-r1; the upload layer below deliberately installs the pinned closure's libstdc++
# 16.2.0-r2 and libgcc 16.2.0-r2, which SUPERSEDE the libstdc++ pin in the final image. Both sides are immutable archive
# hashes recorded in runtime-packages.lock.json under uploadNativeProvenance.declaredFinalVersions, and the outcome is
# asserted at the end of the upload layer rather than left implicit.
# The retained vendor-signed index and the complete pinned native closure of all three native layers are staged as
# one local apk repository in the build-only native-repository stage above. Each archive is an official aarch64
# archive pinned by exact URL and sha256 (the source lock records the same bytes). apk verifies the index signature
# with the vendor keys already present in the pinned base and then installs only from these staged bytes: no network,
# no untrusted-file exception. The read-only mount carries that repository into each install RUN and is released with
# it, so the archives and index apk only reads cannot become image content.
# --repositories-file /dev/null is what makes "only from these staged bytes" literal. In apk 2.14.12 -X/--repository is
# additive and does not replace the configured set, and --no-network only stops fetching (the cache is still used when
# possible), so the base's configured Chainguard repository stays in apk's repository set - the failed 319cb785 build
# opens it from cache. Overriding the system repositories file and repositories.d leaves the staged directory as apk's
# only repository set, so the staged signed index is the single possible source rather than an observed one.
# No repository COPY in this stage: each native install below mounts the assembled repository read-only for the
# length of that RUN (see the native-repository stage above), so those bytes reach apk through the mount and never
# become layers of the exported image.
# The pinned base's own /etc/apk/world - read from the digest-bound image, not inferred - pins the libc family at r9:
# glibc-2.44=2.44-r9, ld-linux-2.44=2.44-r9, libcrypt1-2.44=2.44-r9 and glibc-2.44-locale-posix=2.44-r9. That family is
# version-locked: the retained index's glibc-2.44 2.44-r10 requires ld-linux-2.44=2.44-r10, ld-linux-2.44 2.44-r10
# requires glibc-2.44=2.44-r10, libcrypt1-2.44 2.44-r10 requires glibc-2.44=2.44-r10, and the base's installed r9 records
# require glibc-2.44=2.44-r9 exactly. Naming only glibc-2.44 at r10 therefore left the world's r9 pins standing on the
# other members, and build f612f243 aborted here, at [runtime 8/22], with "unable to select packages": its own solver
# output satisfies the request as world[glibc-2.44=2.44-r10] while ld-linux-2.44-2.44-r9 and libcrypt1-2.44-2.44-r9 break
# it by requiring glibc-2.44=2.44-r9. Naming a name in the request supersedes the base's world pin for that name (the same
# log shows world[glibc-2.44=2.44-r10] being satisfied), so the whole family is named in one transaction and every member's
# effective world entry becomes r10. All four are the r10 records the source lock declares under systemPackages and the
# ADD list above stages; nothing is fetched and no world file is rewritten.
# apk --version is recorded before the first install so the build log itself carries the effective apk-tools version
# instead of leaving it a premise; this is static recipe text and no version is claimed until a real build logs it.
RUN --mount=type=bind,from=native-repository,source=tmp/meri-native-repo,target=/tmp/meri-native-repo,readonly \
    test "$(uname -m)" = aarch64 && \
    apk --version && \
    apk add --no-cache --no-network --repository /tmp/meri-native-repo --repositories-file /dev/null --update-cache \
      bash=5.3-r14 libatomic=16.2.0-r1 libstdc++=16.2.0-r1 python-3.13=3.13.16_git20261016-r2 \
      py3.13-pip=26.2.2-r0 py3.13-pip-base=26.2.2-r0 \
      glibc-2.44=2.44-r10 glibc-2.44-locale-posix=2.44-r10 ld-linux-2.44=2.44-r10 libcrypt1-2.44=2.44-r10 && \
    test "$(python3.13 --version)" = 'Python 3.13.16'
# Fixed native renderer owner. The install resolves from the retained signed index above, so apk's own trust gate (index
# signature plus the index-recorded package identity, verified against the staged bytes) is what admits every archive.
# The source lock records these exact official archives. Availability is established by the child probe on the built image.
# libxml2-16 is named because the renderer's libcmis/librsvg/liblangtag request so:libxml2.so.16 and both libxml2 2.15.0-r0
# and libxml2-16 2.15.4-r1 provide it; leaving it implicit installed the predecessor, which the upload assertions reject.
RUN --mount=type=bind,from=native-repository,source=tmp/meri-native-repo,target=/tmp/meri-native-repo,readonly \
    apk add --no-cache --no-network --repository /tmp/meri-native-repo --repositories-file /dev/null --update-cache libreoffice-26.8=26.8.2.2-r0 \
      libxml2-16=2.15.4-r1 bubblewrap=0.13.1-r0 util-linux-misc=2.42.4-r1 font-liberation=2.1.5-r6 && \
    test -x /usr/lib/libreoffice/program/soffice && test -x /usr/bin/bwrap && test -x /usr/bin/prlimit
# Fixed native upload scanner/OCR/parser owner. The Wolfi APKINDEX is a rolling live file, so the whole transitive native
# closure is staged (exact official archive, exact sha256, in the ADD list and in the source lock) beside the retained,
# vendor-signed index that is committed under infra/product-preview/native-apk-index. apk admits these archives through
# that index's signature and its recorded package identity; the install runs with --no-network, so no dependency can be
# silently resolved or fetched from a live index. Individual .apk files are no longer passed to apk as local paths, which
# apk refuses as untrusted.
# ClamAV is NOT installed from this repository any more. The Wolfi clamav-1.5 family (engine 1.5.2-r7,
# scanner and freshclam 1.5.2-r0) is the payload the retained scan reports seven HIGH advisories against, and the
# vendor's declared fixed revision is unpublished, so the scanner, the FreshClam signed-CVD provisioner and
# sigtool --info publisher-signature verification come from the source-built payload staged below instead. The
# three Wolfi clamav-1.5 install requests are removed rather than shadowed: no distribution package record and no
# 1.5.2 ClamAV payload remains in this image, and the component inventory records the sha256 of the replacement's
# installed executables and shared libraries (its executable and library surface, not every file in the image).
# The eight clamav-1.5 family archives stay in the pinned staging closure above, byte for
# byte, as immutable pinned inputs; they are simply no longer requested by any install.
# Poppler and Tesseract are the PDF rasterizer and OCR engine.
# Pinned transitive native closure of the seven archives above: every archive this layer could install from the
# rolling live Wolfi index as a transitive dependency, pinned by exact official URL and sha256 (the source lock
# holds the same records). Without these pins the build silently takes whatever provider revision the live index
# serves for a soname or package name. The same name-by-name rule covers the finals already present in the base or an
# earlier layer: they are requested explicitly so they are upgraded to the declared version instead of silently
# satisfying the soname at the older revision. The libc family is the one set that has to be named as a whole, since
# its members are version-locked to each other and the base's world pins them together (see the python layer above).
RUN --mount=type=bind,from=native-repository,source=tmp/meri-native-repo,target=/tmp/meri-native-repo,readonly \
    apk add --no-cache --no-network --repository /tmp/meri-native-repo --repositories-file /dev/null --update-cache \
      tesseract=5.5.0-r2 tesseract-eng=5.5.2-r2 poppler-utils=26.03.0-r3 poppler=26.03.0-r3 \
      leptonica=1.87.0-r1 icu-libs=75.1-r42 libarchive=3.8.10-r0 openssl-3.6-libcrypto=3.6.5-r6 \
      libgcc=16.2.0-r2 libstdc++=16.2.0-r2 libatomic=16.2.0-r1 && \
    test -x /usr/bin/tesseract && test -x /usr/bin/pdftoppm && \
    tesseract --list-langs 2>/dev/null | grep -qx eng && \
    for p in poppler-26.03.0-r3 poppler-utils-26.03.0-r3 tesseract-5.5.0-r2 tesseract-eng-5.5.2-r2 leptonica-1.87.0-r1 libxml2-16-2.15.4-r1 libarchive-3.8.10-r0 openssl-3.6-libcrypto-3.6.5-r6 icu-libs-75.1-r42 libgcc-16.2.0-r2 libstdc++-16.2.0-r2 libatomic-16.2.0-r1 glibc-2.44-2.44-r10; do \
      apk info -v | grep -qx "$p" || { echo "unexpected native dependency $p"; exit 1; }; done && \
    if apk info -v | grep -qx libstdc++-16.2.0-r1; then \
      echo "the renderer layer's libstdc++ 16.2.0-r1 survived the declared upgrade to 16.2.0-r2"; exit 1; fi
# The source-built ClamAV payload replaces the vulnerable Wolfi payload by presence, not by PATH precedence: the
# Wolfi clamav-1.5 packages are not installed at all, so /usr/bin/clamscan, /usr/bin/sigtool, /usr/bin/freshclam and
# the rest of the tool surface are the built 1.5.4 binaries and nothing older sits behind them. The install prefix is
# /usr, which is where the sandbox contract's absolute tool paths point (apps/runtime/uploads/native-sandbox.mjs),
# so no runtime path changes and no symlink, shim or PATH ordering decides which ClamAV runs. The inventory written by
# the build stage is re-checked against the installed bytes here, so the record is bound to what this image actually
# carries rather than to what the build intended to install.
COPY --from=clamav-source-build /tmp/meri-clamav-out/ /
RUN cd / && sha256sum -c /usr/share/meri/clamav-component-inventory.txt && \
    test -x /usr/bin/clamscan && test -x /usr/bin/sigtool && test -x /usr/bin/freshclam && \
    test -x /usr/bin/clamdscan && test -x /usr/bin/clamdtop && test -x /usr/bin/clamconf && \
    test -x /usr/sbin/clamd && test -x /usr/sbin/clamav-milter && test -x /usr/sbin/clamonacc && \
    test -x /usr/bin/clambc && test -x /usr/bin/clamsubmit && test -x /usr/bin/clamav-config && \
    test -n "$(ls /usr/lib/libclamav.so.* 2>/dev/null)" && test -n "$(ls /usr/lib/libfreshclam.so.* 2>/dev/null)" && \
    test -n "$(ls /usr/lib/libclamunrar.so.* 2>/dev/null)" && \
    for tool in /usr/bin/clamscan /usr/bin/sigtool /usr/bin/freshclam /usr/bin/clamdscan /usr/bin/clamdtop /usr/sbin/clamd; do \
      "$tool" --version 2>&1 | grep -q 'ClamAV 1.5.4' || { echo "unexpected ClamAV version from $tool"; exit 1; }; done && \
    printf 'meri-native-signature-probe\n' > /tmp/meri-sigtool-probe && \
    test "$(sigtool --md5 /tmp/meri-sigtool-probe | awk '{print $1}')" = "$(md5sum /tmp/meri-sigtool-probe | awk '{print $1}')" && \
    grep -q '"upstreamVersion":"1.5.4"' /usr/share/meri/clamav-component-provenance.json && \
    ! apk info -v | grep -q '^clamav-1.5' && \
    rm -f /tmp/meri-sigtool-probe && \
    echo "source-built ClamAV payload installed; no clamav-1.5 distribution package is present"
# The coverage check and its advisory table travel with the image so the retained build probe binds the recorded
# coverage to this image's own bytes: the probe runs the check inside the built image with no network, and the
# build fails when the binary's reported version, the installed files or the provenance record disagree.
COPY infra/product-preview/clamav_component_coverage.py infra/product-preview/clamav-source-advisories.json /usr/share/meri/

# Wolfi uses glibc. Copy only Node/npm from the official builder; the final
# image retains Wolfi's Python, native dependencies and system CA trust.
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    test "$(node --version)" = v24.22.1 && test "$(npm --version)" = 12.2.1
COPY --from=builder /opt/meri /opt/meri
COPY infra/product-preview/runtime-wheels.lock.json /opt/meri/infra/product-preview/runtime-wheels.lock.json
COPY infra/product-preview/runtime-packages/requirements.lock.txt /opt/meri/infra/product-preview/runtime-packages/requirements.lock.txt
COPY infra/product-preview/runtime-packages/executor-generation-smoke.mjs /opt/meri/infra/product-preview/runtime-packages/executor-generation-smoke.mjs
# pip owns wheel compatibility, hash verification and dependency validation.
# No source builds, network resolution or manual site-packages extraction.
RUN --mount=type=bind,source=infra/product-preview/runtime-packages/wheels,target=/tmp/runtime-wheels,readonly --network=none \
    python3.13 -I -m pip install --break-system-packages --no-cache-dir --no-index --only-binary=:all: --require-hashes \
      --find-links=/tmp/runtime-wheels -r /opt/meri/infra/product-preview/runtime-packages/requirements.lock.txt && \
    python3.13 -I -m pip check
RUN addgroup -g 1000 node && adduser -D -u 1000 -G node -h /home/node -s /bin/bash node
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
RUN test "$(id -u node)" = 1000 && test "$(id -g node)" = 1000 && mkdir -p /run/meri /run/meri-temporal /run/meri/upload-scratch /run/meri/upload-definitions /workspace && chown node:node /run/meri /run/meri-temporal /run/meri/upload-scratch /run/meri/upload-definitions /workspace && chmod 0700 /run/meri /run/meri-temporal /run/meri/upload-scratch /run/meri/upload-definitions /workspace && chmod 1777 /tmp
USER 1000:1000
VOLUME ["/run/meri", "/run/meri-temporal", "/tmp", "/workspace"]
EXPOSE 8080
ENTRYPOINT ["node"]
CMD ["apps/runtime/agentcore-entrypoint.mjs"]
