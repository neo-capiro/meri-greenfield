#!/usr/bin/env bash
# 18-execute-app [MUTATING] execute app; control/worker gate
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: 1/1/0, runtime.listening, both target groups healthy.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 18-execute-app
