#!/usr/bin/env bash
# 19-verify [read-only] verify-outputs and public health
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: STAGE3_TASK_DEFINITIONS_MATCH_RENDER; HTTP 200.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 19-verify
