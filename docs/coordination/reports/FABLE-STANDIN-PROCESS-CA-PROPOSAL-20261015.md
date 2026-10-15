# Qualification-only process-scoped extra-CA proposal (prepared, not executed)

Author: Fable, 15 October 2026. Status: PROPOSAL FOR ONE ACTION-TIME APPROVAL; nothing below was executed; the denied operation (C1b rerun with a per-process extra CA) was not retried; no CA was installed, no hosts entry written, no TLS verification disabled. Dot's review of `d2acf82` asked for this alternative instead of the container-wide CA route, with exact commands, a unique disposable target identity, scrubbed inherited environment and CA access, negative and positive controls, bounded lifetime, failure-safe cleanup limited to owned changes and actual readbacks. The container-wide packet (`FABLE-STANDIN-APPROVAL-PACKET-20261015.md`) stays on HOLD; its script defects listed by dot are corrected in section 6.

## 1. What the route is and why it is still a trust change

The pinned CLI 2.1.295 honors `NODE_EXTRA_CA_CERTS` (probe C1b reached TLS, `GET /api/hello` and `POST /v1/messages?beta=true`). A qualification harness can therefore trust the stand-in's private CA **for the stand-in's own process tree only** by adding that one variable to the process that launches the CLI, while the container's system store and `/etc/hosts` stay untouched. That is a trust change for that process and its descendants and needs the exact action-time approval; it does not establish product parity, because the product launch environment is exactly five variables and the configured proxy host is a DNS name. The proposal therefore binds the extra variable at the **harness's SDK option layer** and keeps the product descriptor bytes, template, hash and matching gates unchanged: the qualification run records a separate `qualificationEnv` that is hashed and compared independently, never merged into the product template.

## 2. Exact patch shape (source, reviewed before any approval)

- `scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs`: a new explicit option `qualificationTrust` = `{caFile, proxyOrigin}` (absent by default). When present, the rehearsal (a) starts the stand-in on `127.0.0.1` with an ephemeral port and an IP-SAN leaf signed by the private CA, so no hosts entry is needed; (b) sets the SDK `spawnClaudeCodeProcess` environment to the product template's five variables **plus** `NODE_EXTRA_CA_CERTS=<caFile>`, recorded as `launchTemplate.qualificationEnvSha256` in the receipt next to the unchanged product `envKeysSha256`; (c) sets `ANTHROPIC_BASE_URL` to `https://127.0.0.1:<port>` for that process only, recorded the same way; (d) asserts that the product descriptor captured from the SDK (`descriptor.env`) still has exactly the five product keys when `qualificationTrust` is absent, and exactly those five plus the two qualification keys when present, so the gate cannot be satisfied by a template-only edit.
- `provider-standin.mjs` is unchanged (IP-SAN leaf support is a certificate property, not a server change).
- No change to `apps/runtime` or the admitted CLI configuration.

## 3. Unique disposable target identity and scrubbed environment

| Item | Value |
|---|---|
| Container | the ephemeral cloud session container (hostname `vm`, PID 1 `process_api`, per-session block device); no shared host |
| Process identity | one `node` process started by `runuser -u meri` with `env -i` (no inherited environment) and only `HOME`, `PATH`, `TMPDIR`, `MERI_REVIEW_SOURCE_ROOT`, `MERI_REHEARSAL_RECEIPT`, `MERI_QUALIFICATION_CA=<caFile>`; the CLI child receives the product five plus the two qualification keys and nothing else (the SDK option sets the child env explicitly) |
| CA access | the private CA key stays in a fresh owner-only directory of uid 30033 (`/home/meri/standin-trust-<runId>/`, created with `mkdir` that fails if it exists); only `ca.crt` is readable by the harness; the key is deleted at the end of the run |
| Lifetime | CA and leaf valid 1 day; the run is bounded by `timeout --kill-after=10s 900s`; the stand-in exits on SIGTERM and its exit is awaited |
| Readbacks before and after | `/usr/local/share/ca-certificates` listing and `sha256sum /etc/ssl/certs/ca-certificates.crt` (the effective bundle), `/etc/hosts` bytes, `ss -ltnp` for the stand-in port, `ps -u meri` empty, directory absent |

## 4. Exact commands (not executed)

```sh
#!/bin/bash
set -euo pipefail
R=/home/user/meri-fable-complete; RUN=$(cat /proc/sys/kernel/random/uuid); D=/home/meri/standin-trust-$RUN; OUT=/home/meri/complete-out/standin-trust-$RUN
mkdir "$D"; mkdir "$OUT"; chown meri:meri "$D" "$OUT"
# Baseline readbacks of the untouched container trust (these must be identical after the run).
sha256sum /etc/ssl/certs/ca-certificates.crt > "$OUT/bundle-before.sha256"; ls /usr/local/share/ca-certificates > "$OUT/ca-dir-before.txt"; cp /etc/hosts "$OUT/hosts-before"
cleanup(){ set +e
  [ -n "${PID:-}" ] && kill -TERM "$PID" 2>/dev/null; [ -n "${PID:-}" ] && wait "$PID" 2>/dev/null
  rm -f "$D/ca.key" "$D/server.key" "$D/server.csr" "$D/ext.cnf" "$D/ca.srl" "$D/ca.crt" "$D/server.crt"; rmdir "$D" 2>/dev/null
  sha256sum /etc/ssl/certs/ca-certificates.crt > "$OUT/bundle-after.sha256"; ls /usr/local/share/ca-certificates > "$OUT/ca-dir-after.txt"; cp /etc/hosts "$OUT/hosts-after"
  cmp -s "$OUT/bundle-before.sha256" "$OUT/bundle-after.sha256" && cmp -s "$OUT/ca-dir-before.txt" "$OUT/ca-dir-after.txt" && cmp -s "$OUT/hosts-before" "$OUT/hosts-after" && echo 'container trust unchanged' > "$OUT/trust-readback" || echo 'CONTAINER TRUST DIFFERS' > "$OUT/trust-readback"
  ss -ltnp > "$OUT/listeners-after.txt"; ps -u meri -o pid=,comm= > "$OUT/meri-processes-after.txt"; [ ! -e "$D" ] && [ ! -s "$OUT/meri-processes-after.txt" ] && echo 'cleanup verified' > "$OUT/cleanup-readback" || echo 'CLEANUP INCOMPLETE' > "$OUT/cleanup-readback"; }
trap cleanup EXIT
# Key material owned by uid 30033, IP SAN only, no hosts mapping.
runuser -u meri -- bash -c "cd '$D' && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=meri-qualification-ca-$RUN' -keyout ca.key -out ca.crt -addext 'basicConstraints=critical,CA:TRUE' && openssl req -newkey rsa:2048 -nodes -subj '/CN=127.0.0.1' -keyout server.key -out server.csr && printf 'subjectAltName=IP:127.0.0.1\\nbasicConstraints=CA:FALSE\\n' > ext.cnf && openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 1 -extfile ext.cnf -out server.crt && chmod 600 ca.key server.key"
# Negative control N (no trust): the rehearsal must fail closed at the preflight with the CA variable absent.
runuser -u meri -- env -i HOME=/home/meri PATH=/opt/nvm/versions/node/v24.21.0/bin:/usr/bin:/bin TMPDIR=/home/meri/resume-tmp MERI_REVIEW_SOURCE_ROOT="$R" MERI_REHEARSAL_RECEIPT="$OUT/negative.json" MERI_QUALIFICATION_CERT="$D/server.crt" MERI_QUALIFICATION_KEY="$D/server.key" \
  bash -c "cd '$R' && timeout --kill-after=10s 300s node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs" > "$OUT/negative.log" 2>&1 || echo "negative exit $?" >> "$OUT/negative.log"
# Positive run P (the approval item): the same with the process-scoped CA for the harness and its CLI child only.
runuser -u meri -- env -i HOME=/home/meri PATH=/opt/nvm/versions/node/v24.21.0/bin:/usr/bin:/bin TMPDIR=/home/meri/resume-tmp MERI_REVIEW_SOURCE_ROOT="$R" MERI_REHEARSAL_RECEIPT="$OUT/positive.json" MERI_QUALIFICATION_CERT="$D/server.crt" MERI_QUALIFICATION_KEY="$D/server.key" MERI_QUALIFICATION_CA="$D/ca.crt" \
  bash -c "cd '$R' && timeout --kill-after=10s 900s node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs" > "$OUT/positive.log" 2>&1 || echo "positive exit $?" >> "$OUT/positive.log"
```

The rehearsal itself starts and stops the stand-in inside the harness process (no background job, no `cd` outside the subshell), so `PID` is only set if a stand-in is started outside it; the trap handles both.

## 5. Controls the run must produce before it counts

Negative: preflight `REHEARSAL_PROVIDER_STANDIN_REQUIRED` with the CA absent (no request reaches the listener). Positive: the two-turn rehearsal through the real CLI and control plane with the receipts the rehearsal already writes (issuance, next-run selection, kickoff, checkpoint capture and readback, retirement, revocation), the descriptor assertions of section 2, zero cost, and the trust readbacks of section 3 unchanged. A positive run is qualification evidence for the harness route only, not product parity and not live acceptance.

## 6. Corrections to the container-wide packet (kept on HOLD)

Dot's listed defects and the corrections applied to that packet's script text in the same commit: C2 and the Node `--use-system-ca` probe are now explicit steps (C2 after step 2, with the CA installed, as the experiment's result; N1c reinterpreted: with the CA absent everywhere it cannot identify store selection and is only a hint); the effective trust bundle `/etc/ssl/certs/ca-certificates.crt` is hashed before and after, not just the source directory; `cleanup verified` requires the `update-ca-certificates --fresh` exit code 0 and the bundle hash equal to the baseline; the output directory is created with `mkdir` that fails if it exists; the final readback lists listeners (`ss -ltnp`) and uid 30033 processes and requires both empty. These are text corrections to a held packet; nothing was executed.

## 7. Approval requested

One action-time approval for the positive run P of section 4 in this disposable container, with the source patch of section 2 reviewed first. Decline leaves the multi-turn rehearsal with the real CLI UNRUN on the real route only.
