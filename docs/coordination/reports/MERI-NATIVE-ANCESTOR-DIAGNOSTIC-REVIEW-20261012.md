# Independent native ancestor diagnostic source review

Status: IN PROGRESS. Base `90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`; isolated branch `review/meri-native-ancestor-diagnosis-20261012`, worktree `/workspace/meri-native-ancestor-diagnosis-review-20261012`. This reviewer owns only this report and the candidate's `review/` directory. Source author and integration owner remain separate. No native operation or delegation.

## Acceptance controls before author freeze

The reviewer communicated these criteria before inspecting candidate source: retain the actual Windows/Python 3.11.15 and fixed local-drive restriction; inspect ancestor metadata root first; stop on the first rejected ancestor before inspecting descendants; identify role and one-based ancestor ordinal/count; distinguish symbolic-link, reparse and non-directory predicates individually and simultaneously; expose bounded integer mode/Windows attributes/reparse tag/error numbers without full paths or exception text. No target bodies, directory enumeration, writes, subprocess, network or collector import is permitted. Every success remains diagnostic-only with false runner/build/runtime admission. Input, iteration, internal deadline and output bounds must remain explicit; the existing external 15-second supervisor remains required because blocking native syscalls cannot be preempted by a Python deadline.

Independent checks will challenge path syntax before metadata, mapped/remote drive refusal, root-first ordering and no descendants after refusal, every predicate and combined predicates, role progression, native errors, elapsed deadlines, bounded privacy-preserving CLI errors, safe import and original-source preservation. Synthetic Windows stat records are source characterization, not Windows execution or qualification. The original generic refusal establishes only the reached rejection branch; it cannot identify which ancestor or predicate failed.

## Primary API semantics

Python documents `lstat`/`follow_symlinks=False` as avoiding name-surrogate reparse traversal, including symlinks and directory junctions. Windows stat results expose `st_file_attributes`, and `st_reparse_tag` identifies the reparse type when the attribute is set. The candidate must retain the broad attribute-bit refusal; a non-symlink reparse directory is still rejected. These checks are not proof against ancestor replacement races. [Python 3.11 os documentation](https://docs.python.org/3.11/library/os.html#os.lstat).

Microsoft defines `GetDriveTypeW` return 3 as fixed media and 4 as a remote drive; its root path takes the drive root with a trailing separator. A fixed drive result alone says nothing about later reparse ancestors. [GetDriveTypeW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getdrivetypew), [file attribute constants](https://learn.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants).

Only public documentation and repository source were read. No target-native paths, credentials, customer data or file bodies were accessed. Root maps role/ordinal to the user's separately held original receipt; no guessed private path is published.
