# Provider stand-in trust: one-time approval question (nothing executed)

Author: Fable. Base `215930c8092577e84da563b1496d1cca9a4ad4d7`. Status: QUESTION FOR THE OWNER; every command below remains stopped. Dot's instruction: "The certificate/hostname changes remain unapproved. Fable should propose a bounded disposable-container setup with cleanup rather than rerun the denied command." The denied commands and their verbatim denial texts are in [DENIED-OPERATIONS.md](../../qualification/candidates/fable-resume-20261015/DENIED-OPERATIONS.md).

## 1. Why a trust binding is needed at all

The local multi-turn rehearsal (`scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs`) drives the real CLI through the real control plane. Lifecycle-path prompts are `client_composed`, so the CLI sends them to the provider URL even for `/status`; the product launch environment is exactly five variables and carries no CA variable; so the only way the real CLI can reach the canned stand-in (`provider-standin.mjs`, HTTPS, no model, no paid call) is a trust store the CLI already consults and a name it already resolves. That is a host-level binding, which is why it was denied as a TLS weakening and why it is a decision for the owner, not for Fable.

## 2. Container identity and scope

| Item | Value |
|---|---|
| Container | managed ephemeral cloud session container, hostname `vm`, PID 1 `process_api`, root filesystem on a per-session block device; reclaimed after inactivity |
| Shared host, workstation or runner | none involved; no Codex runtime is installed; `/opt/codex/...` is Fable's own baseline shim |
| Mount scope touched by the proposal | `/usr/local/share/ca-certificates/` (one new file), `/etc/ssl/certs/` (regenerated bundle), `/etc/hosts` (one appended line), `/root/meri-standin/` (keys and certificates, created) |
| Existing trust store contents | six CA files already installed by the environment (agent proxy and egress gateway CAs); none is touched |
| Runtime under test | CLI binary `@anthropic-ai/claude-agent-sdk-linux-x64/claude` 2.1.295, sha256 `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`, a self-contained executable (not run through the system Node); Node v24.21.0 for the rehearsal script itself |
| Credentials | none created, read or stored; the stand-in token is the synthetic `ANTHROPIC_AUTH_TOKEN` already used by every local fixture |

Because the container is disposable, the risk of the binding is confined to this session's lifetime; cleanup in section 5 removes it anyway so the evidence does not depend on reclamation.

## 3. Trust-path verification before any binding (read-only, can run now)

The CLI is a compiled executable and may consult the system bundle, its own bundled roots, or both. The owner should know which before approving. Read-only probes, no trust change:

```sh
# 1. Does the CLI honor the system bundle? Run the stand-in with a self-signed cert on a loopback port and point the CLI at it by IP
#    (no hosts change, no CA install); expect a TLS failure that names the untrusted issuer.
# 2. Does Node 24 honor the system bundle? node -e "https.get('https://127.0.0.1:PORT', ...)" with and without --use-system-ca; expect
#    failure without the flag, since Node uses its bundled roots unless NODE_EXTRA_CA_CERTS or --use-system-ca is given.
```

Outcome A (CLI consults the system bundle): the binding in section 4 is sufficient. Outcome B (CLI uses only bundled roots): no container trust change can work, the local real-CLI multi-turn rehearsal is not possible by this route, and the question becomes moot; the rehearsal stays blocked on the real route. Probe 1 needs a certificate the CLI trusts to separate outcome A from B, so it is the first approved step. Two read-only facts were collected without any trust change (15 October, this container): the CLI binary 2.1.295 (sha256 `4503bfe1…`) contains the strings `NODE_EXTRA_CA_CERTS` (39 hits), `use-system-ca` (8), `SSL_CERT_FILE` (16), `SSL_CERT_DIR` (5), `ca-certificates.crt` (5) and `/etc/ssl/certs` (12), so its embedded runtime carries both the system-bundle path and the extra-CA variable, but whether the system bundle is consulted by default is not established by strings alone; and Node v24.21.0 accepts `--use-system-ca`, which the product launch does not pass. The approval question therefore stands exactly as written: outcome A is plausible but unproven.

## 4. Revised bounded commands (not executed), with rollback

All paths are literal; nothing is removed by variable; no `bash -c` script carries a removal; every created file is listed so cleanup removes only those.

```sh
# Step 1: create the key material in one new directory (no trust change yet).
mkdir -p /root/meri-standin && cd /root/meri-standin && \
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=meri-rehearsal-standin-ca" -keyout ca.key -out ca.crt -addext "basicConstraints=critical,CA:TRUE" && \
openssl req -newkey rsa:2048 -nodes -subj "/CN=proxy.synthetic.invalid" -keyout server.key -out server.csr && \
printf 'subjectAltName=DNS:proxy.synthetic.invalid\nbasicConstraints=CA:FALSE\n' > ext.cnf && \
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -extfile ext.cnf -out server.crt

# Step 2 (the approval item): install exactly one CA file and one hosts line.
cp /root/meri-standin/ca.crt /usr/local/share/ca-certificates/meri-rehearsal-standin.crt && update-ca-certificates
printf '127.0.0.1 proxy.synthetic.invalid\n' >> /etc/hosts

# Step 3: start the stand-in on loopback port 443 (the rehearsal's fixed origin is https://proxy.synthetic.invalid) as a
# task-owned foreground process with a 15-minute timeout, then run the rehearsal as uid 30033; receipts to /home/meri/resume-out/rehearsal-standin/.
cd /home/user/meri-fable-resume && timeout --kill-after=10s 900s node --input-type=module -e "import {startProviderStandIn} from './scripts/qualification/first-chat-rehearsal/provider-standin.mjs';const s=await startProviderStandIn({certFile:'/root/meri-standin/server.crt',keyFile:'/root/meri-standin/server.key',host:'127.0.0.1',port:443});console.log('standin',s.port);process.on('SIGTERM',()=>s.close().then(()=>process.exit(0)));" &
runuser -u meri -- env -i HOME=/home/meri PATH=/opt/nvm/versions/node/v24.21.0/bin:/usr/bin:/bin TMPDIR=/home/meri/resume-tmp \
  MERI_REVIEW_SOURCE_ROOT=/home/user/meri-fable-resume MERI_REHEARSAL_RECEIPT=/home/meri/resume-out/rehearsal-standin/receipt.json \
  node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs
kill -TERM %1; wait %1   # the stand-in exits; its exit is recorded in the receipt
```

Rollback (section 5) is the inverse of step 2 and the removal of the step 1 directory, and nothing else.

## 5. Cleanup ownership and the exact removals

Fable owns cleanup in the same session, immediately after step 3, success or failure, and records a receipt (`CLEANUP-RECEIPT` style) with before and after listings:

```sh
rm /usr/local/share/ca-certificates/meri-rehearsal-standin.crt && update-ca-certificates --fresh
sed -i '/^127\.0\.0\.1 proxy\.synthetic\.invalid$/d' /etc/hosts
rm /root/meri-standin/ca.key /root/meri-standin/ca.crt /root/meri-standin/ca.srl /root/meri-standin/server.key /root/meri-standin/server.csr /root/meri-standin/server.crt /root/meri-standin/ext.cnf && rmdir /root/meri-standin
```

Only the created CA file, the created hosts line and the created key directory are removed; the six pre-existing CA files and every other hosts line stay. The receipt lists `/usr/local/share/ca-certificates`, the `/etc/hosts` line count and the absence of `/root/meri-standin` after cleanup.

## 6. What is explicitly not requested

- No blanket future Bash permission rule; the approval is for the two commands of step 2 in this container, once.
- No change to the installed Codex runtime anywhere; no `/opt/codex` rebinding (that question is separate and also stopped).
- No model or provider call; the stand-in returns canned Messages responses.
- No change to the product launch environment, the CLI binary or the trust path of the product.

## 7. Question for the owner

Approve step 2 once in this disposable container, with Fable running the section 3 probes first and the section 5 cleanup after, or decline and keep the real-CLI multi-turn rehearsal on the real route only.
