#!/usr/bin/env bash
# 06-measurement-payload-put [MUTATING] S3: one create-only KMS payload object
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: payload-pin.json written from authenticated HEAD.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 06-measurement-payload-put
