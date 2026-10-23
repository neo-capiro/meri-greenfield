#!/usr/bin/env bash
# 07-measurement-finalize [local] finalize the measurement start request
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: OFFLINE_MEASUREMENT_REQUEST_FINALIZED.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 07-measurement-finalize
