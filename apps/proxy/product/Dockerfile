# Two stages. The assembly is the digest-pinned image built by the UNCHANGED
# apps/proxy/qualification/linux/Dockerfile (Debian, offline hash-pinned wheels,
# Prisma generation). It is a builder only and never deployed. The product image
# is the separately pinned Wolfi glibc-2.44 runtime (the qualified Node image's
# base) with CPython 3.13 installed offline from a retained, signed-index snapshot.
# There is no floating/default image and no network in any RUN.
ARG PROXY_ASSEMBLY_IMAGE
ARG PROXY_RUNTIME_IMAGE
FROM ${PROXY_ASSEMBLY_IMAGE} AS assembly
FROM ${PROXY_RUNTIME_IMAGE} AS product
ARG PROXY_ASSEMBLY_IMAGE
ARG PROXY_RUNTIME_IMAGE

USER root
# The snapshot is bind-mounted, never copied into a layer. apk authenticates the
# signed index with the base's pinned key and each package's control/data identity.
# No allow-untrusted, network fallback or floating upgrade.
RUN --mount=type=bind,source=proxy-runtime-packages,target=/tmp/proxy-runtime-repo,readonly --network=none \
    printf '%s\n' 'f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc  /etc/apk/keys/wolfi-signing.rsa.pub' | sha256sum -c - && \
    (cd /tmp/proxy-runtime-repo/x86_64 && sha256sum -c ../SHA256SUMS) && \
    apk --repositories-file /dev/null --keys-dir /etc/apk/keys --repository /tmp/proxy-runtime-repo \
      add --no-network --no-cache $(cat /tmp/proxy-runtime-repo/PACKAGES)

# A fresh venv on the Wolfi interpreter at the same path, receiving only the
# verified installed packages, the generated Prisma client and the Prisma engines.
RUN --network=none /usr/bin/python3.13 -I -m venv --without-pip /opt/meri-proxy-venv
COPY --from=assembly /opt/meri-proxy-venv/lib/python3.13/site-packages/ /opt/meri-proxy-venv/lib/python3.13/site-packages/
COPY --from=assembly /opt/prisma/ /opt/prisma/
COPY --from=assembly /opt/meri-proxy/assembly-pins.json /opt/meri-proxy/requirements.lock /opt/meri-proxy/
COPY --from=assembly /opt/meri-proxy/build-evidence/ /opt/meri-proxy/build-evidence/
ENV PYTHONDONTWRITEBYTECODE=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_INDEX=1 LITELLM_LOCAL_MODEL_COST_MAP=True HOME=/tmp/meri-home TMPDIR=/tmp

WORKDIR /opt/meri
COPY apps/proxy/product/ ./apps/proxy/product/
COPY apps/proxy/qualification/runtime/ ./apps/proxy/qualification/runtime/
COPY apps/proxy/qualification/state/ ./apps/proxy/qualification/state/
COPY apps/proxy/qualification/test/test_ingress.py ./apps/proxy/qualification/test/test_ingress.py
COPY apps/proxy/qualification/linux/assembly-pins.json apps/proxy/qualification/linux/requirements.lock /opt/meri-proxy/product-inputs/

RUN --network=none /opt/meri-proxy-venv/bin/python -E -B -m apps.proxy.product.runtime_packages verify \
      --lock apps/proxy/product/runtime-packages.lock.json > /opt/meri-proxy/build-evidence/runtime-packages.json && \
    cat /opt/meri-proxy/build-evidence/runtime-packages.json
RUN --network=none /opt/meri-proxy-venv/bin/python -I -B -c \
    'import os,re,sys,json,hashlib,importlib.metadata as m; from pathlib import Path; assert re.fullmatch(r"[^\s]+@sha256:[0-9a-f]{64}",os.environ["PROXY_ASSEMBLY_IMAGE"]); lock=json.loads(Path("apps/proxy/product/runtime-packages.lock.json").read_text()); assert os.environ["PROXY_RUNTIME_IMAGE"]==lock["runtimeImageUri"]; assert sys.platform=="linux" and "%d.%d"%sys.version_info[:2]==lock["pythonMinor"] and sys.prefix=="/opt/meri-proxy-venv"; p=Path("/opt/meri-proxy"); assert all((p/n).read_bytes()==(p/"product-inputs"/n).read_bytes() for n in ("assembly-pins.json","requirements.lock")); assert (p/"build-evidence/generated-client.json").stat().st_size>0; assert all(m.version(k)==v for k,v in {"litellm":"1.104.2","httpx":"0.28.1","botocore":"1.43.111","boto3":"1.43.111","uvicorn":"0.51.0","h11":"0.16.0","prisma":"0.11.0"}.items()); assert hashlib.sha256(Path("apps/proxy/product/litellm-product-config.yaml").read_bytes()).hexdigest()=="64860d829d7c022f6640b1a75eb48ad05dc2421d8e5e2bcdfdda50b421754d19"; assert not any(Path(x).exists() for x in ("/usr/bin/dpkg","/var/lib/dpkg"))'

# Package presence above is mandatory, so this installed-native smoke cannot
# silently skip. Network-none prevents provider/metadata/telemetry dispatch.
# No listener/key/DB/credential is created by the smoke; full TLS+SDK success is
# a separate bounded qualification gate, not implied by image construction.
USER 10001:10001
RUN --network=none /opt/meri-proxy-venv/bin/python -E -B -m unittest apps.proxy.product.test.test_main.InstalledNativeStartup
ENV MERI_PRODUCT_PROXY_REQUIRED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 8443
ENTRYPOINT ["/opt/meri-proxy-venv/bin/python", "-E", "-B", "-m", "apps.proxy.product.main"]
# The deployment must supply --config and --config-sha256 plus separately
# reviewed task-role/TLS material delivery. There is no default activation.
