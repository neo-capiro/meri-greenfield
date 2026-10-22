#!/usr/bin/env bash
# 05-measurement-prepare [local] prepare the launch-measurement payload
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: OFFLINE_MEASUREMENT_PAYLOAD_PREPARED_AWAITING_VERSION_PIN.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 05-measurement-prepare
