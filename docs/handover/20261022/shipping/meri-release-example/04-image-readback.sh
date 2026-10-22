#!/usr/bin/env bash
# 04-image-readback [read-only] wait for the build; authenticate receipt, ECR digest/tag, scan; write candidate deployment inputs
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: SUCCEEDED; scan COMPLETE with 0 HIGH / 0 CRITICAL; runnerSha256 joins.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 04-image-readback
