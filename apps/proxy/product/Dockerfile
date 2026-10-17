# Supply an independently qualified digest built by the UNCHANGED
# apps/proxy/qualification/linux/Dockerfile with its exact pinned artifact set.
# There is no floating/default image and no artifact download in this recipe.
# The assembly/image/artifact availability is a separate shipping prerequisite.
ARG PROXY_ASSEMBLY_IMAGE
FROM ${PROXY_ASSEMBLY_IMAGE} AS product
ARG PROXY_ASSEMBLY_IMAGE

USER root
WORKDIR /opt/meri
COPY apps/proxy/product/ ./apps/proxy/product/
COPY apps/proxy/qualification/runtime/ ./apps/proxy/qualification/runtime/
COPY apps/proxy/qualification/state/ ./apps/proxy/qualification/state/
COPY apps/proxy/qualification/test/test_ingress.py ./apps/proxy/qualification/test/test_ingress.py
COPY apps/proxy/qualification/linux/assembly-pins.json apps/proxy/qualification/linux/requirements.lock /opt/meri-proxy/product-inputs/

# Reuse the original Debian/CPython venv/native generation in place. Never copy
# it into the separate Wolfi Node worker image or resolve another package set.
RUN --network=none /opt/meri-proxy-venv/bin/python -I -B -c \
    'import os,re,sys,hashlib,importlib.metadata as m; from pathlib import Path; assert re.fullmatch(r"[^\s]+@sha256:[0-9a-f]{64}",os.environ["PROXY_ASSEMBLY_IMAGE"]); assert sys.platform=="linux" and sys.version_info[:3]==(3,13,5); p=Path("/opt/meri-proxy"); assert all((p/n).read_bytes()==(p/"product-inputs"/n).read_bytes() for n in ("assembly-pins.json","requirements.lock")); assert (p/"build-evidence/generated-client.json").stat().st_size>0; assert all(m.version(k)==v for k,v in {"litellm":"1.104.2","httpx":"0.28.1","botocore":"1.43.111","boto3":"1.43.111","uvicorn":"0.51.0","h11":"0.16.0"}.items()); assert hashlib.sha256(Path("apps/proxy/product/litellm-product-config.yaml").read_bytes()).hexdigest()=="64860d829d7c022f6640b1a75eb48ad05dc2421d8e5e2bcdfdda50b421754d19"'

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
