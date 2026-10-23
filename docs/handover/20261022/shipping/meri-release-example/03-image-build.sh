#!/usr/bin/env bash
# 03-image-build [MUTATING] CodeBuild: ONE product image build (30/5/0)
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: build id recorded; no other build active; tag new.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 03-image-build
