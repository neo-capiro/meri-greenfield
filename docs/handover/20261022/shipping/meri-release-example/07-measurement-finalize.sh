#!/usr/bin/env bash
# 07-measurement-finalize [local] finalize the measurement start request
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: OFFLINE_MEASUREMENT_REQUEST_FINALIZED.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 07-measurement-finalize
