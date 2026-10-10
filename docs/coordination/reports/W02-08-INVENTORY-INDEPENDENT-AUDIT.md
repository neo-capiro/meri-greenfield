# Independent static image-inventory audit

Codex integration-owner audit, 9 October 2026. Candidate `c769e4cec3f1dadb6453667b2193e7be0ed7d603` is **rejected pending correction**. This is an offline source decision; no image build, Linux traversal or security acceptance occurred.

The frozen inventory source hashes to `01b673c02faf67ce8de2a3b3dd3a6739956e4f527207abd0a5621cf12e245d02`; its test file hashes to `a03811cd3ec1879b0f68766631633bf7d5fe89d745fd01ef1123ba3c4d255da0`. An independent Codex reader and the integration owner each ran all 20 tests successfully with the bundled Python 3.12.14 runtime. The owner's earlier unpinned invocation used Python 3.11.15 and returned 17 pass / 3 fail because its Windows fixture runtime lacks `os.path.isjunction`. That failed attempt is retained; specify the fixture runtime explicitly.

Four additional fabricated Linux-path countercases reproduce false success:

| Case | Observed defect | Required correction |
| --- | --- | --- |
| Reviewed `/bin` alias replaced during target validation | Complete coverage and success survive replacement to `/outside`. | Recheck captured alias identity and target before accepting coverage. |
| Recorded child directory changes mode before descent | A `0755` to `2755` transition produces no unexpected privilege entry and still succeeds. | Carry recorded directory identity into descent; reject changed mode/identity. |
| Ancestor above a declared root becomes a link | Initial ancestor check is not bound to later traversal. | Revalidate full ancestor chains against captured identities. |
| Normalized output spelling differs from the exact literal | `/opt//meri-worker/image-inventory.json` is accepted but CLI emission is suppressed; exit zero with no mandatory file. | Require the exact output literal or consistently emit the accepted canonical path. |

Independent reproduction is retained privately as `.task-inputs/image-inventory-independent-c769.py`, SHA256 `4100c7a698d6d470e3d6f9613966a07ed87dba974c0a7695e03cee8826ccce8c`. Windows CLI refusal passed without traversal or output. These tests inject filesystem facts; they do not prove actual container coverage or absence of renamed features.

The separate real Hermes image completion session is already running against pinned base `c769e4c` with these two inventory files read-only. Preserve its base and one-writer boundary. Apply the correction after that session closes, then independently replay the four failures and obtain a separate real Hermes exact-candidate review before build admission. Current image `7327` remains subject to its unresolved 2 critical / 13 high findings; no waiver is implied.
