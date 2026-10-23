#!/usr/bin/env bash
# 15-changesets [MUTATING] CloudFormation: create (not execute) model, issuer and app change sets
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: only TaskDefinition/Service changes.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 15-changesets
