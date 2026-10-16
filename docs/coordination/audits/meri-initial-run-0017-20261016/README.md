# Initial-run binding 0017: disposable PostgreSQL qualification

Source under review: `apps/control/conversations/migrations/0017_initial_run_bindings.sql`, `apps/control/conversations/test/initial-run-binding-migration-pg.test.mjs`, and the opt-in control startup mount in `apps/runtime/control.mjs`. The selected mount source was `0606044bed17f220430daa180d451aa6f7b78073` before this report commit. The 0017 SQL blob was `4fa941a215b3dac2f2a5cfbca190d7b73549b670`; the test blob was `e19b51119cbcfe37907caf8619a0a12fc27c3206`.

## Native result

On 2026-10-16, the test ran under Node 24 against a fresh, disposable PostgreSQL **16.15** cluster bound only to Windows loopback `127.0.0.1:55418`. It applied the exact ordered conversation migrations 0001–0011, 0013, 0015, 0016, 0017. The source fixture attested the exact data directory, postmaster executable/PID, listener, server version, database name, and process profile before creating any test database. A task-owned wrapper initialized, started, stopped, and removed the cluster; after completion the data and scratch directories were absent and the port was free.

The [redacted native output](windows-loopback-redacted.txt) records **9 tests, 9 passes, 0 failures**, `testExit: 0`, and no cleanup failure. This repository copy normalizes line endings and removes trailing spaces from the blank failure fields; the result and test lines are unchanged. SHA-256 of the committed output: `101548985b500e929814e6699112bb8c7f4af69aa3578df3224c3b49afd989b4`. Coverage includes rejection of unapproved servers, exact predecessor apply and older-row preservation, JSON/identity constraints, stored SHA enforcement, narrow app-role permissions, concurrent claim serialization, preexisting original refusal, lost COMMIT acknowledgement recovery, and private dump/restore.

The Windows profile requires the explicit isolated-test switch, the exact task-owned data directory and control database, port 55418, and an ephemeral password supplied only to the disposable cluster. No password, secret material, live database address, or credential file is in this report. The Unix-socket profile was **not run**. This is migration/source qualification, not proof of a deployed database migration, serving role grant, model response, or live first chat.

## Startup mount check

The control mount is opt-in through literal `nativeCandidate.multiRun.dynamicInitialRuns: true` with the existing absolute material directory. The journal borrows the control pool. A missing journal port, an unexpected journal port, or a missing 0017 relation fails closed. The focused Node 24 startup, dynamic binding/identity, admission, and journal tests passed **33/33** at the selected local source. An independent read-only review accepted the narrow mount. The default configuration remains static. A separate broader Windows candidate-config run still encounters inherited Unix-path fixture failures; it is not counted as passing.
