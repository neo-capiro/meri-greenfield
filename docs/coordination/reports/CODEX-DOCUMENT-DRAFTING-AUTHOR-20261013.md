# Document application author

Base: PR49 `b5243ae164f68c7591b039e8365d9897390543d2`. Source freeze: `8e21145f7f4745d20e84c3c2e51efcd93d33483f`. Earlier exact `4fbce759` remains preserved. Root fixture dependency: `fc456f4d`, imported as identical `28756c29`; do not duplicate it during integration.

Implemented three new modules under `apps/control/document-application/`: native Request admission/content-free errors; trusted configuration and current session composition; and four-route application dispatch. Canonical PostgresArtifactService handles writes, ArtifactService handles reads, canonical artifact validators/format helpers handle data, and createRequestCurrent owns receipt freshness. No original production file, public schema, catalog, policy, renderer, model loop or approval engine changed. Default application activation is false. DOCX/TXT are the intentionally admitted partial create_word capability; PDF is not claimed.

The context and allocation used for artifact request identity remain exact across deliveries. All fresh receipts must preserve full current binding, scopes and selected client. Receipt expiry is published synchronously to the outer lifetime before the next port call. Inspect/download never reserve budget. Downloads preserve the verified exact bytes and canonical attachment metadata. Started-write errors remain conservatively UNKNOWN; acknowledged result withheld at release is RESULT_NOT_RELEASED. No retry or physical stop is inferred.

Checks retained under `docs/qualification/candidates/document-drafting-20261013/author/`:

- Initial 12 controls: 8 pass / 4 fail. Exact initial modules/tests preserved at `f82e31fa`. Three failed positive flows used a nonexistent `/usr/local/bin/python3` author fixture; one DOCX fixture incorrectly used `paragraph.text` instead of canonical `runs`. The initial uncertainty assertion happened to pass because the bad executable failed; it was rerun with the actual executor before being counted as meaningful.
- Corrected fixture plus new controls: 14/15 pass; descriptor mutation was accepted. This actual application gap was retained at `8916368c`.
- Canonical descriptor correlation repair: 15/15 pass, no skip/cancel/timeout/kill. Includes real local TXT and DOCX generation; two immutable versions; exact original/new downloads; one shared canonical accounting ledger at 20 microUSD after two writes; no generation or reservation on replay; session revocation; inert hostile input; and a shorter authority expiry followed by a parked session call.

- Independent review then reproduced hostile borrowed-port rejection reflection in the existing owner catch path. Four appended author controls retained 2 pass / 2 fail against `4fbce759`; the actual failures were authorize/authority Proxy traps. New-adapter-only sanitization preserves inert finite codes before canonical owners receive errors. Exact repaired source passes all 19 author controls; no existing owner was edited.

Captured process groups 505599, 505996, 506166, 507547 and 507861 were physically absent after the checks, with no group kill required. Root separately owns the actual loopback full-document flow and its captures. All source tests use a scripted PostgreSQL ledger and synthetic identity/current-policy ports; no native database, cloud/provider/customer call was made. Actual local python-docx process success is source evidence only.

Independent source review is pending at this report revision. Production source activation, live identity/admission, native persistence, native Office rendering and isolation remain separate qualification work. This source is reviewable and mountable through the existing listener/session owners without frontend or Capiro changes.
