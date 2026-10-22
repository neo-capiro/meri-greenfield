#!/usr/bin/env bash
# 10-stage3-input [read-only] latest revisions and predicted task definitions
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: stage3.json written.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 10-stage3-input
