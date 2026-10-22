#!/usr/bin/env bash
# 14-bindings [read-only] live outputs and app template; bindings; pre-deploy ship packet
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: STAGE3_BINDINGS_WRITTEN; SHIP_PACKET_WRITTEN.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 14-bindings
