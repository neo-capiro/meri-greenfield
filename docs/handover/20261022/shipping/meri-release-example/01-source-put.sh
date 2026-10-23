#!/usr/bin/env bash
# 01-source-put [MUTATING] S3: two create-only KMS objects (sealed source zip + manifest)
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: HEAD matches length, SHA256 and KMS for both.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 01-source-put
