#!/bin/sh
# The Node 24 binary and its GNU loader/libraries are a measured set copied by the
# digest-pinned temporal-launch.Dockerfile; the musl base has no glibc of its own.
# The Temporal child receives a fresh environment without this library path.
exec /opt/meri/node-loader --library-path /opt/meri/node-lib /opt/meri/node /opt/meri/temporal-launch-main.mjs "$@"
