#!/usr/bin/env bash
# 13-secret-upload [MUTATING] Secrets Manager: five new versions under a new label only
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: new versions carry only the label; all earlier labels unchanged.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 13-secret-upload
