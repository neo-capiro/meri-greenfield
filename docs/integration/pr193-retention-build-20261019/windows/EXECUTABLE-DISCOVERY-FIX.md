# PowerShell 5.1 executable discovery correction

The d608f321 wrapper could emit only `PR193_REFUSED` before `PR193_PUBLIC_PREPARATION`. Actual Windows PowerShell5.1 reproduced two `node.exe` matches and three `git.exe` matches from `Get-Command -CommandType Application`; `.Source` was therefore an array. The entry point had assumed one executable. The successor explicitly selects the first discovered application, retaining ordinary PATH precedence and the explicit `-NodePath` option. Node24 validation remains required.

Unexpected exceptions now emit a fixed `PR193_REFUSED_AT_<PHASE>` code. Missing Node and Git executables have dedicated constant codes. Exception text, executable paths and private values are never returned. Path traversal, reparse, ACL, source/hash and output-existence checks are unchanged.

`Test-Pr193Prerequisites.ps1` is read-only: it reports PowerShell/.NET versions, sanitized Node/Git versions and match counts, drive-root traversal result, and PKI/Core/output path metadata codes. It never opens private file contents, creates output, fetches Git, installs dependencies, calls AWS, renders or uploads. Run it with the same local parameter variables as the render wrapper.

Root's actual Windows PowerShell5.1 diagnostic observed drive-root traversal PASS and captured Node/Git version calls PASS after selecting the first executable. Fake path metadata returned only fixed codes with no canary leakage. This establishes a local failure mechanism; Neo's exact machine diagnosis remains dependent on his sanitized result. No private operator material was accessed during preparation.
