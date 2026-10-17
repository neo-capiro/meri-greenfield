# W08 fixed check numbers

## Current ownership: Meri resumed at 01:34:09 UTC

**Neo reversed only the Meri stop/handoff at 2026-10-17 01:34:09 UTC. Codex/dot retains Meri qualification and shipping preparation and continues without waiting for Fable. Codex/dot owns shipping coordination. The immutable frontend/Core handoffs remain technical checkpoints from their source owners; their Fable assignment is historical. Dot retains step 3: the real authenticated prompt, streamed answer, saved conversation and reload acceptance.**

The 01:19:23 UTC Meri stop and the later local-seal inventory below are historical pre-start checkpoints. Their no-upload/no-StartBuild and unused-reservation statements describe that cut, not current live operations. The root Meri thread and its exact later operation receipts are authoritative for subsequent attempt identity, upload, start, terminal result and budget consumption. This document update does not start or approve any operation.

| ID | Stage | Existing operation or assertion |
|---:|---|---|
| 1 | START | Create private fixture |
| 2 | START | Construct writer |
| 3 | START | Register close hook |
| 4 | START | Start writer |
| 5 | START | Assert delivery request shape |
| 6 | START | Assert delivery signal |
| 7 | START | Construct delivery response |
| 8 | FIRST_METADATA | Read first file metadata |
| 9 | FIRST_METADATA | Assert owner-only mode |
| 10 | FIRST_METADATA | Assert UID |
| 11 | FIRST_METADATA | Assert link count |
| 12 | FIRST_READ | Read through existing token file reader |
| 13 | FIRST_READ | Assert first token equality |
| 14 | REFRESH | Advance test clock |
| 15 | REFRESH | Refresh writer |
| 16 | SECOND_METADATA | Read replacement metadata |
| 17 | SECOND_METADATA | Assert distinct inode |
| 18 | SECOND_READ | Read replacement through existing reader |
| 19 | SECOND_READ | Assert second token equality |
| 20 | STATUS | Read writer health |
| 21 | STATUS | Assert health |
| 22 | STATUS | Assert status redaction |
| 23 | CLOSE | Close writer explicitly |
| 24 | CLEANUP | Check token file absence |
| 25 | CLEANUP | Assert token file absence |
| 26 | CLEANUP | Read fixture directory |
| 27 | CLEANUP | Assert directory empty |
| 28 | CLEANUP | Assert no pending timers |
| 29 | CLEANUP | Close writer in the existing after-hook |
| 30 | CLEANUP | Remove the private fixture directory in its existing after-hook |

Check 0 means an unwrapped failure. The delivery callback records the first failing check before the production writer normalizes its exception. Checks 29 and 30 use independent hook state so a previous test-body failure cannot mask either cleanup failure. Other tests use the shared fixture's original cleanup behavior. Node 24 wraps after-hook failures; the fixed stage and fields survive in its cause chain. No actual, expected, token, error message, or stack is surfaced by these fields.
