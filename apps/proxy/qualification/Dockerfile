# Meri W02-02 trusted model proxy qualification image recipe (PREPARATION ONLY).
#
# NOT BUILT: no Docker daemon is available on the authoring host and no cloud
# build is authorized in this ticket. assembledImageDigest stays null until Codex
# performs a real isolated build (see component-pins.json). Do NOT treat this
# recipe as an accepted runtime.
#
# Build context is THIS qualification package directory so the owned
# .dockerignore applies (only proxy-config.json, component-pins.json,
# Dockerfile, README.md, .dockerignore enter the context):
#   docker build --pull --platform linux/amd64 \
#     -f apps/proxy/qualification/Dockerfile \
#     -t <ecr>/meri-greenfield/qualification-proxy:<sha> \
#     apps/proxy/qualification
#
# ---------------------------------------------------------------------------
# VERIFIED upstream image resolution (inspected from the registry 2026-10-09):
#   repository      ghcr.io/berriai/litellm
#   tag             v1.104.2
#   index digest    sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500
#   linux/amd64     sha256:ff11074add7b1cee63759b90eb2a9e4072763e520297761ea05a911b4a5b251d
#   config digest   sha256:db4055eec62df7f5f23828795de317b1856275178688ce1735ca16e1b343044c
#   OCI revision    fc3920bf403124ad075bc04990f999f7e0612e12  (== pinned source commit)
#   base            Chainguard wolfi-base (dev.chainguard.image.title)
#   default user    root  (image config User = "root")
# Pin the immutable INDEX digest (not the moving tag). No placeholder digest is
# used anywhere in this file.
#
# UNVERIFIED and BLOCKING for later live use: cosign/signature verification; the
# image's default root user (non-root / read-only-root-filesystem suitability is
# NOT established); Prisma migration/state topology. This recipe does NOT enable
# a non-root USER override, because doing so without live verification would be a
# false claim: the upstream entrypoint (docker/prod_entrypoint.sh) may require
# root. Codex must prove non-root + read-only operation in isolation before any
# live use. No Docker socket, no host networking, no added capabilities.
# ---------------------------------------------------------------------------
FROM --platform=linux/amd64 ghcr.io/berriai/litellm@sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500

WORKDIR /app/meri-qualification

# Only the reviewed config enters the image. The offline policy reference, its
# fixture and its tests are NOT shipped (excluded by .dockerignore).
COPY proxy-config.json ./
COPY component-pins.json ./

# The upstream image ships the Prisma toolchain (PRISMA_* env) required for
# Postgres-backed virtual keys. NO migration is run here and no database/master/
# salt value is baked in: database_url and master_key are resolved at runtime from
# the environment (os.environ/LITELLM_DATABASE_URL, os.environ/LITELLM_MASTER_KEY)
# supplied by the Codex-owned ECS task definition / secrets plane. The future
# trusted admission CustomLogger instance is intentionally NOT registered here
# (litellm_settings.callbacks is empty): the broker/hook integration is a later
# bounded ticket, and naming a non-existent handler would break startup.
ENTRYPOINT ["litellm", "--config", "/app/meri-qualification/proxy-config.json", "--host", "0.0.0.0", "--port", "4000"]
