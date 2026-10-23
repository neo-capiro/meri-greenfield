#!/usr/bin/env bash
# 12-private-render [PRIVATE] certificate check, revisions unchanged, render five roles (operator only)
# Commit eb6579204f495eb35140f4e1cb013b641913da5f, kit C:/dev/fable/ship-eb657920. Expected outcome / gate: MERI_FIRST_CHAT_MATERIAL_RENDERED; verify-rendered exit 0.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-eb657920'
exec node kit.mjs 12-private-render
