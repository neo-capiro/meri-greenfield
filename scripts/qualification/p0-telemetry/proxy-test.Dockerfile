ARG PYTHON_IMAGE
FROM public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63 AS node
FROM ${PYTHON_IMAGE}
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY requirements.lock /tmp/requirements.lock
RUN python -m venv /opt/meri-proxy-venv \
 && /opt/meri-proxy-venv/bin/pip install --no-cache-dir --require-hashes --only-binary=:all: -r /tmp/requirements.lock \
 && useradd -u 10001 -M meri
