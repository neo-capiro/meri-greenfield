#!/usr/bin/env bash
# 04-image-readback [read-only] wait for the build; authenticate receipt, ECR digest/tag, scan; write candidate deployment inputs
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: SUCCEEDED; scan COMPLETE with 0 HIGH / 0 CRITICAL; runnerSha256 joins.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 04-image-readback
