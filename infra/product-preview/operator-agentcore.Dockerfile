# Config-only packaging of the already qualified common image. No install, COPY,
# RUN or product rebuild. Release must pass its immutable repository@sha256 digest.
ARG COMMON_IMAGE
FROM ${COMMON_IMAGE}
CMD ["apps/runtime/operator-case-entrypoint.mjs", "agentcore"]
