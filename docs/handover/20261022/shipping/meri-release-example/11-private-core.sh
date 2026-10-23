#!/usr/bin/env bash
# 11-private-core [PRIVATE] bearer read, Core membership POST, core.json (operator only)
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: membership HTTP 200; summary exit 0; core-values written.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 11-private-core
