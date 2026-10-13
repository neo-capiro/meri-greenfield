# Independent preservation-size review

ACCEPT_SOURCE `2444edc0d6bcfb5771bf26eda9e1c8eb06525783`, baseline `a16e52ef5bd8d570c995dff298facbc0d1969000`.

The exact fixed preservation query uses a one-row, 4,194,304-byte UTF-8 JSON ceiling. Ordinary query decoding retains its 1,048,576-byte / 1,024-row ceiling. Shared inert data, depth and node guards, complete metadata hashing and before/after equality are unchanged. Only schema-contract.mjs and schema.mjs changed among 11,565 baseline entries; all 11,563 others, including SQL, migrations, native fixture and original tests, are exact.

Independent unchanged 23 controls passed on reviewer merge 6577a77c in 1.824s: boundaries ±1 byte including multibyte text; complete synthetic 3,128,280-byte inventory preparation and reconstruction; last-array and last-character mutations; unsupported/hostile/count rejection; oversized nonpreservation query; pre-DDL refusal, post-DDL UNKNOWN and lost COMMIT acknowledgement. Baseline 13 PASS / 10 FAIL remains raw. Baseline negative-helper passes only reflected its absence and are not acceptance evidence; final replay invokes the actual helper. No test assertions were changed between runs.

The inventory is constructed synthetic metadata with the reported serialized byte length, not a copy of the native inventory or evidence of native SQL installation. No native packet, database, provider, cloud or frontend was accessed. Both owned process groups 528800/529623 are physically absent; no kill/timeout, dependencies or services were allocated. The capture helper is a Linux subreaper with 180-second subprocess bound. Source/stream identities are in audit.json and raw capture receipts.
