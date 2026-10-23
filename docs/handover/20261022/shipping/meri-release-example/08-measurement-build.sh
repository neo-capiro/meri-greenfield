#!/usr/bin/env bash
# 08-measurement-build [MUTATING] CodeBuild: ONE measurement build (10/5/0), no model request
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: build id recorded.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 08-measurement-build
