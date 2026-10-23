# Preview infrastructure instructions

Apply [root instructions](../../AGENTS.md), the current [standing requirements](../../docs/handover/20261022/STANDING-REQUIREMENTS.md), and [validation/shipping workflow](../../docs/handover/20261022/CODEX-VALIDATION-AND-SHIPPING.md). Root Codex owns AWS and shipping; edit only the exact infra inputs, renderer, contracts and migration files allocated to your lane.

Item 0 removes the model proxy/owner, per-operation authority, reservation machinery and temporal-issuer in its planned steps. Delete replaced resources and kit steps with their owning change. Do not extend or qualify these components to satisfy superseded tickets. Preserve Core's canonical authorization and required negative tests.

Use a real Git checkout, `MERI_REVIEW_SOURCE_ROOT`, `node_modules/@capiro` workspace links and Python `cryptography >=42`. Root coordinates local gates in WSL Codex-Gates with Node 24, native Docker and isolated PostgreSQL 16. Tests use isolated databases and throwaway PKI, never live or clone data.

Regenerate archived recipes for the current exact source/live baseline; never execute a kit to discover its arguments. Root uses AWS `default` in `us-east-1`; inspect explicit historical profile flags. New images are ARM64. Snapshot before forward migration of the persistent preview clone; never delete/re-clone it or migrate shared live data. Keep preview rules host-scoped and live ALB rules unchanged. Coordinate the preview deploy lock, rollback and acceptance window; no concurrent release or deploy during live acceptance.

Private inputs stay in owner-only scratch, never Git/logs. Verify owned paths before cleanup, remove task-created secrets/files after use, and retain scrubbed source/image/config and failure evidence. Historical pair-restart and issuer instructions apply only to a still-required transition step explicitly selected by root; they are not requirements for the new SDK architecture.
