# Ancestor metadata diagnostic outline

Author gateway_author, independent reviewer gateway_reviewer, parent root.
Base `90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`; isolated branch
`task/meri-native-ancestor-diagnosis-20261012`; 20-minute author bound.
Root approved the outline and the reviewer froze independent criteria before
source edits. Original diagnostic and collector remain byte-identical.

Implement only a standalone ancestor metadata diagnostic under the new candidate
directory. Reuse the original predicates conceptually, without importing or
instrumenting the collector or the earlier diagnostic. Require the original
win32/Python 3.11.15 runtime and fixed local drive. Validate bounded local absolute
path syntax before native drive checks or filesystem metadata access. Inspect the
original roles in order: repository, output-parent, basePrefix, Lib, DLLs. Walk
root to leaf and stop immediately at the first rejected ancestor.

Report the role, one-based ordinal and ancestor count, individual symlink,
reparse-point and not-directory predicates, stat mode, Windows file attributes
and reparse tag. OS/API errors retain only stage and numeric errno/winerror.
Do not emit paths or exception text. Successful earlier roles report counts only.
Inputs remain --repository and --original-output; the parent binds their exact
values from the actual receipt. No stdlib traversal, stream mode, body reads,
hashing, filesystem writes, subprocess, network or collector execution exists.

Bounds: five roles, at most 64 ancestors each, path length 1024, ten-second
cooperative deadline, at most 32KiB ASCII JSON stdout. The existing external
15-second supervisor remains mandatory because metadata calls may block. Exit 0
means current ancestor observations only; exit 2 means refusal. Neither grants
runner/build/runtime/G1 acceptance or reconstructs the original failing run.

Local source controls cover root-first stopping, simultaneous predicates, safe
numeric errors, unsafe paths before IO, runtime admission, output bounds, role
ordering and no body IO. Native execution is not assigned to this author. A
junction/reparse refusal may be correct; no deterministic Windows compatibility
defect is inferred from the parent's generic refusal.
