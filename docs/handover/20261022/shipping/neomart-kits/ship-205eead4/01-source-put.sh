#!/usr/bin/env bash
# 01-source-put [MUTATING] S3: two create-only KMS objects (sealed source zip + manifest)
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: HEAD matches length, SHA256 and KMS for both.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 01-source-put
