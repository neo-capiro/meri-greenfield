# Preservation size repair — source handoff

Base: `a16e52ef5bd8d570c995dff298facbc0d1969000`.
Source: `2444edc0d6bcfb5771bf26eda9e1c8eb06525783`.

The exact preservation query can now admit one complete4MiB metadata row while ordinary query results retain1MiB/1024 rows. No schema, migration, SQL, namespace policy, original test or ordinary query behavior changed. The existing `README-schema.md` is preserved per root closeout direction; this report documents the narrow size change.

## Bounds and representation


Only the exact fixed `preservationSQL` result uses `preservationRows`: exactly
one row and at most **4,194,304 UTF-8 bytes** for the complete serialized rows
array. The parent-reported native inventory was3,128,280 bytes; this fixed ceiling
provides about34.1% headroom. It is not a caller-controlled limit. Ordinary query
results retain the existing1,048,576-byte and1,024-row bounds.

The entire metadata object is admitted before its existing exact fingerprint is
computed; no truncation, partial projection, changed query or precomputed-hash
substitution is introduced. Canonical inert-data checks still reject proxies,
accessors, cycles and invalid data and retain the16MiB/100,000-node/depth64 guards.
The preservation envelope still requires one row, zero unsupported objects and
all twelve metadata arrays. Namespace admission and before/after/reconstruction
comparisons are unchanged. Overflow before migrations remains `NOT_INSTALLED`;
overflow after submitted migrations remains `UNKNOWN`, with no successful commit
receipt. This repair is source-tested against scripted metadata, not a native
preservation or installation receipt.

## Verification

- Before-source controls:10/17 PASS,7 retained failures. Complete measured-size and exact-limit snapshots refused before DDL; downstream mutation/ordinary-query controls were blocked by that early refusal. Raw `before.*` and immutable test preimage5176ad2d retained.
- First source replay: my missing `preservationSQL` import caused safe identity-stage refusals. Exact code/failing raw `repaired.*` retained in0d83eaf7; no test expectation changed. The final source adds that missing exact-owner import.
- Final focused replay:241/241 PASS in1.775 seconds, including17 new and224 unchanged schema, compatibility and existing independent controls. This covers complete3,128,280-byte snapshots, exact4MiB ASCII and multibyte inputs, byte+1 refusal, complete tail mutation during migration/reconstruction, post-submission overflow UNKNOWN, ordinary boundaries and hostile/depth/node/count/shape guards.
- Independent reviewer:23/23 unchanged controls PASS on exact2444edc0, with preliminary source acceptance. Reviewer packet is separate.
- Preservation audit:11,565 original Git entries;11,563 unchanged. Only schema-contract.mjs and schema.mjs changed. Complete preservationSQL, all migrations and all original tests are exact base bytes.
- Three bounded author process groups528723,528922,529264 freshly absent; no timeout or forced kill. No dependencies installed/linked, no DB/network/cloud/provider/native calls, no borrowed pool/resources disposed.

## Integration

Ordered author history:ff8eec78 outline/setup diagnostic →5176ad2d immutable controls/initialfailure →0d83eaf7 scoped helper/retained missing-import failure →2444edc0 exact-query import repair/final241pass →final metadata packet. Do not stop at the intermediate0d83 state. Branch `task/meri-preservation-size-20261013` is based on the isolated `/tmp/meri-workbook-source-20261013` repository; original source/alternate checkouts are untouched.

This is scripted source evidence. The measured native byte count was supplied by the parent; this author did not read native metadata, credentials or packets and did not rerun a native query. Actual fixture preservation and installation remain the native owner's separately authorized run.
