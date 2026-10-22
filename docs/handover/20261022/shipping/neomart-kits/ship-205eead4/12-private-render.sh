#!/usr/bin/env bash
# 12-private-render [PRIVATE] certificate check, revisions unchanged, render five roles (operator only)
# Commit 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c, kit C:/dev/fable/ship-205eead4. Expected outcome / gate: MERI_FIRST_CHAT_MATERIAL_RENDERED; verify-rendered exit 0.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd 'C:/dev/fable/ship-205eead4'
exec node kit.mjs 12-private-render
