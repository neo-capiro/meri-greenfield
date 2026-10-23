---
name: reference-windows-searchindexer-commit-leak
description: "Windows SearchIndexer.exe leaks 45-75 GB of committed memory on Neo's machine, pins the commit limit, crashes WSL and grows pagefile.sys to ~96 GB; fix needs admin (disable WSearch or exclude dev folders)"
metadata:
  node_type: memory
  type: reference
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-21T09:05:27.227Z
---

Windows Search (`SearchIndexer.exe`) on Neo's machine repeatedly holds **43–76 GB of private commit** (seen 10-20 at ~70 GB, partly released, back to 73 GB on 10-21 ~09:00Z). Effects:
- Commit sits at 115–125 of ~127 GB, so WSL crashed once (`0x80072746`) and test containers fail.
- **`pagefile.sys` grew to 96 GB**, which cost ~44 GB of C: in a few hours. Get-Item on it returns 0 unless `-Force` and elevated reads differ, so a 0.0 GB reading is wrong.
- It indexes huge trees (`C:\dev`, `Downloads\capiro-*`, `Documents\Codex`, all with node_modules).

**Fix needs admin; I am not elevated and must not change system settings.** Give Neo the commands:
- Immediate: `Stop-Process -Name SearchIndexer -Force` then `Restart-Service WSearch -Force` in an admin PowerShell.
- Permanent: `Set-Service WSearch -StartupType Disabled; Stop-Service WSearch -Force` (reversible; Start-menu file search gets slower), or exclude `C:\dev`, `Downloads` and `Documents\Codex` in Indexing Options.
- A reboot shrinks the system-managed pagefile afterwards.

**How to apply:** at the start of heavy validation runs (WSL Docker, rehearsals), check `Get-Counter '\Memory\Committed Bytes'` and `Get-Process SearchIndexer`. If SearchIndexer is > 20 GB, ask Neo to run the admin commands before launching more containers. Related: [[reference-docker-desktop-broken-use-wsl2-native]].
