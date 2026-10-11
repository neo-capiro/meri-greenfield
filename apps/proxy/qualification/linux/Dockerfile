# NEW community-only qualification candidate. Context is this package plus the
# EXACT artifacts/ records in assembly-pins.json. No adopted full upstream image.
# Build/import/auth/security are separate gates; this source proves none of them.
FROM node:24.21.0-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66

# Same signed fixed-snapshot CA bootstrap as the accepted worker recipe. HTTP
# bootstraps ONLY the CA package; Signed-By remains mandatory. Historical expiry
# is scoped to these sources; signature and later HTTPS verification stay on.
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; \
    printf '%s\n' 'Acquire::http::User-Agent "meri-qualification-snapshot/1";' \
      'Acquire::https::User-Agent "meri-qualification-snapshot/1";' > /etc/apt/apt.conf.d/99meri-snapshot-ua; \
    printf '%s\n' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian/20261009T000000Z' \
      'Suites: trixie' 'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' '' \
      'Types: deb' \
      'URIs: http://snapshot.debian.org/archive/debian-security/20261009T000000Z' \
      'Suites: trixie-security' 'Components: main' \
      'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
      'Check-Valid-Until: no' > /etc/apt/sources.list.d/meri-snapshot.sources; \
    apt-get update; \
    apt-get install -y --no-install-recommends --no-remove ca-certificates=20250419; \
    apt-get clean; rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    sed -i 's|http://snapshot.debian.org|https://snapshot.debian.org|g' /etc/apt/sources.list.d/meri-snapshot.sources; \
    apt-get update; \
    apt-get install -y --no-install-recommends --no-remove python3=3.13.5-1 python3-venv=3.13.5-1; \
    apt-get -y --no-remove dist-upgrade; \
    apt-get clean; rm -rf /var/lib/apt/lists/*; \
    python3 -m venv /opt/meri-proxy-venv; \
    mkdir -p /opt/meri-proxy/build-evidence

COPY assembly-pins.json requirements.lock prisma-build.py import-probe.py /opt/meri-proxy/
COPY artifacts/ /opt/meri-proxy/artifacts/
ENV PYTHONDONTWRITEBYTECODE=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_INDEX=1 LITELLM_LOCAL_MODEL_COST_MAP=True

# No wheel resolution, source build, npm install, external engine fetch or DB.
# BuildKit enforces network-none during BOTH installation and native generation.
RUN --network=none set -eux; \
    /opt/meri-proxy-venv/bin/python -I -B /opt/meri-proxy/prisma-build.py verify \
      > /opt/meri-proxy/build-evidence/artifacts.json; \
    /opt/meri-proxy-venv/bin/python -I -B -m pip install --no-index --no-deps \
      --only-binary=:all: --require-hashes --no-compile \
      --find-links=/opt/meri-proxy/artifacts/wheels -r /opt/meri-proxy/requirements.lock
# Emit these observations BEFORE generation too, so a missing engine cannot hide
# the actual OS/interpreter/package versions. Not an SBOM/security verdict.
RUN --network=none set -eux; \
    node --version > /opt/meri-proxy/build-evidence/node-version.txt; \
    /opt/meri-proxy-venv/bin/python --version > /opt/meri-proxy/build-evidence/python-version.txt; \
    dpkg-query -W -f='${binary:Package}\t${Version}\t${Architecture}\n' \
      > /opt/meri-proxy/build-evidence/dpkg-packages.tsv; \
    /opt/meri-proxy-venv/bin/python -I -B -c \
      'import importlib.metadata as m,json; print(json.dumps(sorted([{"name":d.metadata["Name"],"version":d.version} for d in m.distributions()],key=lambda d:d["name"].lower()),sort_keys=True))' \
      > /opt/meri-proxy/build-evidence/python-distributions.json; \
    test "$(node --version)" = v24.21.0; \
    /opt/meri-proxy-venv/bin/python -I -B -c 'import sys; assert sys.version_info[:3] == (3,13,5)'; \
    cat /opt/meri-proxy/build-evidence/node-version.txt /opt/meri-proxy/build-evidence/python-version.txt; \
    cat /opt/meri-proxy/build-evidence/dpkg-packages.tsv /opt/meri-proxy/build-evidence/python-distributions.json
RUN --network=none set -eux; \
    /opt/meri-proxy-venv/bin/python -I -B /opt/meri-proxy/prisma-build.py generate \
      > /opt/meri-proxy/build-evidence/generated-client.json || \
      { cat /opt/meri-proxy/build-evidence/generated-client.json; \
        if test -f /opt/meri-proxy/prisma-generate.stderr.bin; then head -c 1048576 /opt/meri-proxy/prisma-generate.stderr.bin; fi; exit 1; }; \
    test -s /opt/meri-proxy/build-evidence/generated-client.json; \
    cat /opt/meri-proxy/build-evidence/generated-client.json; \
    chmod -R a+rX /opt/meri-proxy /opt/prisma /opt/meri-proxy-venv

# Qualification execution supplies tmpfs /tmp, network none, read-only root,
# drop ALL, NNP, pids64/memory2GiB/cpus2 and a separate external deadline/removal.
# No provider/AWS/database credentials, server, lifespan or migration entrypoint.
USER 10001:10001
WORKDIR /tmp
ENV HOME=/tmp/meri-home TMPDIR=/tmp
ENTRYPOINT ["/opt/meri-proxy-venv/bin/python", "-I", "-B", "/opt/meri-proxy/import-probe.py"]
