#!/usr/bin/env bash
# 02-build-request [local] request.json, verifier, recipe, size check, start request (no AWS write)
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: image-build-source.py verify exit 0; buildspec within 25 600 B.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 02-build-request
