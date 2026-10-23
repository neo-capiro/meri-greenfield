#!/usr/bin/env bash
# 03-image-build [MUTATING] CodeBuild: ONE product image build (30/5/0)
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: build id recorded; no other build active; tag new.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 03-image-build
