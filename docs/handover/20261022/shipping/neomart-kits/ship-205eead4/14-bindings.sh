#!/usr/bin/env bash
# 14-bindings [read-only] live outputs and app template; bindings; pre-deploy ship packet
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: STAGE3_BINDINGS_WRITTEN; SHIP_PACKET_WRITTEN.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 14-bindings
