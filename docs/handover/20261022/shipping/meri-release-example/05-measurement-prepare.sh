#!/usr/bin/env bash
# 05-measurement-prepare [local] prepare the launch-measurement payload
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: OFFLINE_MEASUREMENT_PAYLOAD_PREPARED_AWAITING_VERSION_PIN.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 05-measurement-prepare
