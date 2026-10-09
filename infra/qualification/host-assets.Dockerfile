# Codex-owned packaging only. Build context: the reviewed repository archive.
# Never started; the new isolated host copies these exact files, then verifies
# them against the per-run reviewed template's sizes and SHA256 hashes.
FROM scratch
ARG SOURCE_COMMIT
LABEL org.opencontainers.image.title="Meri isolated browser qualification support" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}" \
      meri.qualification.kind="browser-host-support-only"
COPY infra/browser-qualification/bootstrap.sh /meri-host-assets/bootstrap.sh
COPY infra/browser-qualification/host-evidence.py /meri-host-assets/host-evidence.py
COPY infra/browser-qualification/seccomp.chromium-155-amd64.json /meri-host-assets/seccomp.json
# No CMD, ENTRYPOINT, RUN, package install, permissions grant or remote ADD.
