#!/bin/sh
# Ordinary Node executable; the image package manager owns its shared libraries.
exec /opt/meri/node /opt/meri/temporal-launch-main.mjs "$@"
