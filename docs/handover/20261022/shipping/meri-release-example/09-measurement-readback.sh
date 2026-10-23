#!/usr/bin/env bash
# 09-measurement-readback [read-only] wait; download six results; verify joins; assemble runtime values
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: MEASUREMENT_VERIFIED_AND_ASSEMBLED.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 09-measurement-readback
