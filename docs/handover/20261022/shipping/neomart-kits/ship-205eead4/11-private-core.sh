#!/usr/bin/env bash
# 11-private-core [PRIVATE] bearer read, Core membership POST, core.json (operator only)
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: membership HTTP 200; summary exit 0; core-values written.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 11-private-core
