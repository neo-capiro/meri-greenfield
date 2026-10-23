#!/usr/bin/env bash
# 02-build-request [local] request.json, verifier, recipe, size check, start request (no AWS write)
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: image-build-source.py verify exit 0; buildspec within 25 600 B.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 02-build-request
