# Provider stand-in trust: one-time approval question (nothing executed)

Author: Fable. Base `215930c8092577e84da563b1496d1cca9a4ad4d7`. Status: QUESTION FOR THE OWNER; every command below remains stopped. Dot's instruction: "The certificate/hostname changes remain unapproved. Fable should propose a bounded disposable-container setup with cleanup rather than rerun the denied command." The denied commands and their verbatim denial texts are in [DENIED-OPERATIONS.md](../../qualification/candidates/fable-resume-20261015/DENIED-OPERATIONS.md).

## 1. Why a trust binding is needed at all

The local multi-turn rehearsal (`scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs`) drives the real CLI through the real control plane. Lifecycle-path prompts are `client_composed`, so the CLI sends them to the provider URL even for `/status`; the product launch environment is exactly five variables and carries no CA variable; so the only way the real CLI can reach the canned stand-in (`provider-standin.mjs`, HTTPS, no model, no paid call) is a trust store the CLI already consults and a name it already resolves. That is a host-level binding, which is why it was denied as a TLS weakening and why it is a decision for the owner, not for Fable.

## 1b. Revision of 15 October (dot's packet fixes)

Dot held step 2 and listed the defects of the first packet: the copy could overwrite an existing CA file, `mkdir -p` could reuse existing data, cleanup removed every matching hosts line, there was no failure-safe trap, the background `cd` did not change the rehearsal's working directory, the TLS probes did not identify the trust store, an IP-address probe needs an IP SAN or preserved SNI, the Node preflight needs `--use-system-ca` confined to the harness, and the temporary CA affects every process using the container's system trust store. Sections 2 to 6 are rewritten accordingly. Execution remains HOLD until dot presents the exact final change for one-time approval and the environment's permission system accepts it; no TLS verification is disabled, no insecure flag is used, and no denied operation is repeated through another tool.

## 2. Container identity, effective privileges and pre-existing state

| Item | Value |
|---|---|
| Container | managed ephemeral cloud session container, hostname `vm`, PID 1 `process_api`, root filesystem `/dev/vda` (ext4) per session; reclaimed after inactivity |
| Effective privileges | the session shell runs as uid 0; the rehearsal runs as uid 30033 (`meri`) via `runuser`; the stand-in needs port 443 and therefore uid 0 |
| Shared host, workstation or runner | none; no Codex runtime is installed; `/opt/codex/...` is Fable's own baseline shim and is not touched |
| Exclusive ownership | this session alone; no other session, user or process uses this container (`ps` shows only the session's own processes and PID 1) |
| Pre-existing trust store | six CA files in `/usr/local/share/ca-certificates/` (`ccr-agent-proxy.crt`, `ccr-agent-proxy-2.crt`, `egress-gateway-ca-production.crt`, `egress-gateway-ca-staging.crt`, `swp-ca-production.crt`, `swp-ca-staging.crt`); recorded as the baseline with sizes and hashes before step 2; none is overwritten or removed |
| Pre-existing hosts entries | `/etc/hosts` has 4 lines and no `proxy.synthetic.invalid` entry; recorded verbatim as the baseline |
| Targets that must be absent | `/usr/local/share/ca-certificates/meri-rehearsal-standin.crt`, `/root/meri-standin/`, any hosts line containing `proxy.synthetic.invalid`; step 2 refuses if any exists |
| Runtime under test | CLI binary `@anthropic-ai/claude-agent-sdk-linux-x64/claude` 2.1.295, sha256 `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`, self-contained executable; Node v24.21.0 for the harness only |
| Credentials | none created, read or stored; the stand-in token is the synthetic one every local fixture uses |
| Disclosure | while the CA file is installed, every process in this container that uses the system trust store (curl, the `gh` CLI, the agent proxy clients) would also trust certificates issued by the rehearsal CA; the CA key never leaves `/root/meri-standin/`, the CA is valid for 2 days, and cleanup runs in the same session on every exit path |

## 3. Trust-path verification (read-only, before any binding)

An untrusted-certificate failure alone does not say which store the client consulted. The probes therefore use two certificates and compare: a leaf signed by a CA that is only in a private PEM file, and a leaf signed by a CA that is only in the container system store (which requires step 2, so the second half runs after approval). Probes use the hostname `127.0.0.1` with an IP SAN (`subjectAltName=IP:127.0.0.1`) so no hosts mapping is needed for the probe itself.

```sh
# Probe N1 (Node, harness only): with the private CA file and --use-system-ca absent, expect UNABLE_TO_VERIFY_LEAF_SIGNATURE;
# with NODE_EXTRA_CA_CERTS=<private CA> expect success. This confirms the harness's own trust path and that --use-system-ca
# is required for Node to see the container store. Neither flag is added to the product launch or the CLI configuration.
# Probe C1 (CLI, no trust change): run the pinned CLI with ANTHROPIC_BASE_URL=https://127.0.0.1:PORT against the stand-in whose
# leaf is signed by the private CA; expect a certificate verification failure recorded verbatim. This proves only that the CLI verifies.
# Probe C2 (CLI, after step 2): the same with a leaf signed by the CA installed in the container store. Success means the CLI consults
# the system store (outcome A); the same failure means it does not (outcome B) and the rehearsal is not possible by this route.
```

Read-only facts already collected (no trust change): the CLI binary contains the strings `NODE_EXTRA_CA_CERTS` (39), `use-system-ca` (8), `SSL_CERT_FILE` (16), `SSL_CERT_DIR` (5), `ca-certificates.crt` (5) and `/etc/ssl/certs` (12), so its embedded runtime carries both the system-bundle path and the extra-CA variable; whether the system store is consulted by default is exactly what probe C2 decides. Node v24.21.0 accepts `--use-system-ca`.

## 4. Bounded commands (not executed), absent-target checks and rollback limited to owned changes

All paths are literal. Every command refuses when its target already exists. The script records the baseline first, installs with `trap` so cleanup runs on every exit path, and works from explicit directories with tracked process IDs.

```sh
#!/bin/bash
set -euo pipefail
R=/home/user/meri-fable-complete; D=/root/meri-standin; CA=/usr/local/share/ca-certificates/meri-rehearsal-standin.crt; OUT=/home/meri/complete-out/rehearsal-standin
# Baseline: refuse if any owned target exists; record pre-existing trust and hosts state.
[ ! -e "$D" ] && [ ! -e "$CA" ] && ! grep -q 'proxy.synthetic.invalid' /etc/hosts || { echo 'owned target already exists; refusing'; exit 3; }
mkdir "$D"; mkdir -p "$OUT"; chown meri:meri "$OUT"
sha256sum /usr/local/share/ca-certificates/*.crt > "$D/baseline-ca.sha256"; cp /etc/hosts "$D/baseline-hosts"; wc -l < /etc/hosts > "$D/baseline-hosts.lines"
STANDIN_PID=
cleanup(){ set +e
  [ -n "$STANDIN_PID" ] && kill -TERM "$STANDIN_PID" 2>/dev/null && wait "$STANDIN_PID" 2>/dev/null
  if [ -e "$CA" ]; then rm "$CA"; update-ca-certificates --fresh > /dev/null; fi
  # Remove only the single line this script appended (exact text), never any other entry.
  if grep -qxF '127.0.0.1 proxy.synthetic.invalid # meri-rehearsal-standin' /etc/hosts; then grep -vxF '127.0.0.1 proxy.synthetic.invalid # meri-rehearsal-standin' /etc/hosts > "$D/hosts.cleaned" && cat "$D/hosts.cleaned" > /etc/hosts; fi
  sha256sum /usr/local/share/ca-certificates/*.crt > "$OUT/after-ca.sha256" 2>/dev/null; cp /etc/hosts "$OUT/after-hosts"; cmp -s "$D/baseline-hosts" /etc/hosts && echo 'hosts restored' > "$OUT/hosts-readback" || echo 'hosts differ from baseline' > "$OUT/hosts-readback"
  diff <(sort "$D/baseline-ca.sha256") <(sort "$OUT/after-ca.sha256") > "$OUT/ca-readback" && echo 'ca store restored' >> "$OUT/ca-readback"
  for f in ca.key ca.crt ca.srl server.key server.csr server.crt ext.cnf baseline-ca.sha256 baseline-hosts baseline-hosts.lines hosts.cleaned; do [ -e "$D/$f" ] && rm "$D/$f"; done; rmdir "$D"
  [ ! -e "$D" ] && [ ! -e "$CA" ] && ! grep -q 'proxy.synthetic.invalid' /etc/hosts && echo 'cleanup verified' > "$OUT/cleanup-readback"; }
trap cleanup EXIT
# Step 1: key material in the owned directory.
( cd "$D" && openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj '/CN=meri-rehearsal-standin-ca' -keyout ca.key -out ca.crt -addext 'basicConstraints=critical,CA:TRUE'   && openssl req -newkey rsa:2048 -nodes -subj '/CN=proxy.synthetic.invalid' -keyout server.key -out server.csr   && printf 'subjectAltName=DNS:proxy.synthetic.invalid,IP:127.0.0.1\nbasicConstraints=CA:FALSE\n' > ext.cnf   && openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -extfile ext.cnf -out server.crt )
# Step 2 (the one-time approval item): exactly one new CA file (refuses to overwrite) and exactly one tagged hosts line.
cp --no-clobber "$D/ca.crt" "$CA" && [ "$(sha256sum < "$CA")" = "$(sha256sum < "$D/ca.crt")" ] && update-ca-certificates > "$OUT/update-ca.log"
printf '127.0.0.1 proxy.synthetic.invalid # meri-rehearsal-standin\n' >> /etc/hosts
# Step 3: stand-in on loopback 443 (tracked PID), then the rehearsal as uid 30033 from its explicit working directory.
( cd "$R" && exec timeout --kill-after=10s 900s node --input-type=module -e "import {startProviderStandIn} from './scripts/qualification/first-chat-rehearsal/provider-standin.mjs';const s=await startProviderStandIn({certFile:'$D/server.crt',keyFile:'$D/server.key',host:'127.0.0.1',port:443});console.log('standin',s.port);process.on('SIGTERM',()=>s.close().then(()=>process.exit(0)));" ) > "$OUT/standin.log" 2>&1 &
STANDIN_PID=$!; sleep 1; kill -0 "$STANDIN_PID"
runuser -u meri -- env -i HOME=/home/meri PATH=/opt/nvm/versions/node/v24.21.0/bin:/usr/bin:/bin TMPDIR=/home/meri/resume-tmp MERI_REVIEW_SOURCE_ROOT="$R" MERI_REHEARSAL_RECEIPT="$OUT/receipt.json" \
  bash -c "cd '$R' && timeout --kill-after=10s 900s node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs" > "$OUT/rehearsal.log" 2>&1 || echo "rehearsal exit $?" >> "$OUT/rehearsal.log"
```

Rollback is the `cleanup` function: the one CA file, the one tagged hosts line and the owned key directory; nothing else. Readbacks after cleanup (`ca-readback`, `hosts-readback`, `cleanup-readback`) are part of the receipt.

## 5. Cleanup ownership

Fable owns cleanup in the same session; it runs through the `trap` on success, failure, interruption and timeout, and the receipt directory keeps the baseline and after-state listings. The receipt is scrubbed (no key material; the CA key is deleted, never copied).

## 6. What is explicitly not requested

- No blanket future Bash permission rule; the approval is for step 2 in this container, once, as the exact script above.
- No change to the installed Codex runtime anywhere; no `/opt/codex` rebinding (stopped).
- No model or provider call; the stand-in returns canned Messages responses.
- No change to the product launch environment, the admitted CLI configuration or the product trust path; `--use-system-ca` and `NODE_EXTRA_CA_CERTS` appear only in the harness probes.
- No disabling of TLS verification, no insecure flag, no re-issue of a denied operation through another tool or host.

## 7. Question for the owner

Approve step 2 once in this disposable container, as the exact script in section 4 with its baseline checks and trap-driven cleanup, with the section 3 probes run first (N1 and C1 need no approval; C2 is the result of the experiment), or decline and keep the real-CLI multi-turn rehearsal on the real route only.
