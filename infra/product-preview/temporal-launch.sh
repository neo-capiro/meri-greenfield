#!/bin/sh
# The Node runtime and its musl loader/libraries come from one exact digest-pinned image.
# The Temporal child receives a fresh environment without this library path.
exec /opt/meri/node-loader --library-path /opt/meri/node-lib /opt/meri/node /opt/meri/temporal-launch-main.mjs "$@"
