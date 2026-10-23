#!/usr/bin/env bash
# 16-execute-model [MUTATING] stop owner+proxy, execute model, start both; owner/proxy gate
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: 1/1/0 on rendered revisions, 120 s, one Cloud Map instance each, PAIR_READY (75 s quiet).
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 16-execute-model
