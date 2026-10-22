P2 **PR-A** implements stages 1 and 2, partner re-proof, and the planned failure rules. Rebased from `main` at `96b6da6dc3e20efe218232af22806ad8f959eb67`. Keep this PR as a **draft**. PR-B remains dependent on PR-A merging and is not included.

Repeated pair discovery around each owner exchange adds request latency, and a same-revision partner replacement currently retires its survivor permanently. This change reuses bounded proofs while retaining the socket, task, generation and request-lifetime fences:

- One discovery renewer per side, 10-second period with jitter, monotonic 30-second leases, bounded synchronous proof on expiry, and a fresh full proof after every new TLS handshake.
- Same-revision partner replacement closes old sockets, sessions and admission authorities before installing a new generation. Re-proof readiness is bounded to 30 seconds; count/revision/network/own-task contradictions retire the process. Partial replies cannot hide a contradictory returned observation. Failed pre-send connection attempts do not consume the post-send reset quota.
- Admission receipts belong to one request lifetime and retain the source, runner peer, generation and issued-expiry checks. The existing five-second watch renews them; answered refusals cut immediately, while unanswered renewals preserve only the remaining lease.
- Read-only failures cancel and evict request-owned clients. Unresolved mutating work still poisons. UNKNOWN holds remain accounted for, RESERVE is never retried, and an uncertain SETTLE can use the existing read-only outcome frame on a freshly proven carrier of the same generation.

Wire frames, gateway reservation/settlement code, and reserve's two Core currentness joins are unchanged. The second join remains inside the transaction. No workflow, IAM, AWS infrastructure, runner, CLI or LiteLLM change is included. No AWS operations or deployment were performed.

The small scope additions to the plan's file list are necessary to make its failure rules effective: the facts/currentness/placement/credential read adapters now own cancellation instead of retaining a process-wide read quarantine; the native readiness callback reflects the pair lease; and the telemetry context can detach scheduled renewal work from request attribution. P1 has not merged, so the new constants live in the plan's permitted `product/budgets.py` and `owner-pair-lease.mjs` locations, including the TTL ≥ 2 × renewal-period guard.

The final internal source review covered the T1–T10 boundaries and found no remaining concrete blocker. It reproduced and then verified fixes for partial-reply drift precedence and pre-send warmup quota exhaustion. This is **not** the required shipping security signoff.

**Security review requested before shipping:** an independent reviewer who neither implemented nor planned the change should review ADR §2.4, `adj-b-PROOF-REUSE-DESIGN.md` §3 T1–T10, and P2 §§3/5/9. Explicitly sign off the residual change from fresh proof around every reply to replies within a valid socket-bound lease, plus replacement-vs-drift classification, post-handshake IP/ENI/task binding, generation revocation, lifetime-only admission reuse and preservation of UNKNOWN holds.

The committed composed test uses real Python↔Node loopback mTLS and canonical channel/budget code, with scripted AWS, SQL, Core and provider ports. After warming all carriers, a 20.2-second request with four five-second watch renewals produces **13 owner exchanges, zero request-path pair discoveries on either side, and 12 owner Core-currentness joins**. These are scripted join counts, not live Core HTTP measurements. Renewers are stopped in this count fixture and the request stays within its 30-second lease; renewal scheduling, expiry and starvation are tested separately. A lost SETTLE acknowledgement recovers through a new TLS operation carrier, with exactly one RESERVE and one SETTLE, one canonical settlement update, and the original 90-microUSD charge. Wrong session, request and principal execute no SQL.

**Not run:** Docker's 24-case image gate; Docker COPY/image closure; first-turn and D3 rehearsals; pinned-proxy-image Python suites; live preview/CloudWatch acceptance; external shipping security review. These remain validation/shipper gates. Host Python uses the exact hashed qualification requirements but is not image qualification. Nothing was merged.

**Host verification**

| Suite | Base pass / fail / skip | Head pass / fail / skip | Base / head seconds |
| --- | ---: | ---: | ---: |
| Proxy host Python | 385 / 0 / 21 | 429 / 0 / 21 | 69.6 / 102.8 |
| budget-currentness | 64 / 0 / 0 | 64 / 0 / 0 | 6.0 / 6.1 |
| contracts | 4383 / 3 / 0 | 4383 / 3 / 0 | 79.9 / 79.1 |
| control | 46 / 1 / 0 | 46 / 1 / 0 | 105.5 / 105.6 |
| infra | 205 / 3 / 2 | 205 / 3 / 2 | 86.5 / 88.7 |
| owner | 218 / 0 / 0 | 271 / 0 / 0 | 14.2 / 17.7 |
| prepared-bootstrap | 6 / 0 / 0 | 6 / 0 / 0 | 1.8 / 1.6 |
| rebase-regressions | 2 / 4 / 0 | 2 / 4 / 0 | 3.5 / 3.7 |
| remote-runner | 6 / 0 / 0 | 6 / 0 / 0 | 1.7 / 1.5 |
| runtime | 695 / 57 / 0 | 695 / 57 / 0 | 237.3 / 238.5 |
| telemetry | 47 / 0 / 0 | 49 / 0 / 0 | 5.9 / 5.7 |
| Runtime typecheck | pass | pass | 5.2 / 5.0 |
| worker | 195 / 4 / 0 | 195 / 4 / 0 | 67.6 / 68.5 |

Completed checks: base 52, head 54. No check timed out.

Base: **6,347 tests — 6,252 passed, 72 failed, 23 skipped.**

Head: **6,446 tests — 6,351 passed, 72 failed, 23 skipped.**

**Zero new failures, zero new skips, zero unexplained test removals; 99 added passing tests.** The 29 renamed tests describe intentional lease/watch/failure-isolation behavior; rejection coverage remains. Both separate bootstrap and remote-runner host attempts passed 6/6 on each side.

Published commit `e76a0eaef6977113b6d750e7b8c8083f952a4fc5` has the exact validated tree `a88a315b3a099c5f4c1867a96126122804457557` (host checks ran at local commit `a7cd19a92bb0c1a336f8db1c625638ff1a93e7b4`).

<details><summary>Reproducible host commands</summary>

Use Bash in each checkout (`96b6da6d` and `e76a0eae`), Node 24.19.0 and Python 3.13.16. Continue after a failing group to capture the full comparison.

```bash
# Host-only dependency setup; existing lockfiles unchanged.
uv venv --python 3.13 ../p2-host-venv
export P2_PYTHON="$(cd ../p2-host-venv && pwd)/bin/python"
uv pip install --python "$P2_PYTHON" --require-hashes --only-binary=:all: \
  -r apps/proxy/qualification/linux/requirements.lock
npm ci --ignore-scripts --no-audit --no-fund
for P2_PREFIX in apps/runtime apps/worker/conversation packages/ui-stream \
  packages/window-resolution apps/control/conversations; do
  npm ci --ignore-scripts --no-audit --no-fund --prefix "$P2_PREFIX"
done
for P2_PREFIX in apps/artifacts/storage apps/artifacts/generation; do
  npm ci --ignore-scripts --no-audit --no-fund --omit=dev --prefix "$P2_PREFIX"
done
# Same three host package links used by the historical §13 harness.
mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk
ln -sfn ../../packages/contracts node_modules/@capiro/meri-contracts
ln -sfn ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk
ln -sfn ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3

# Keep ambient credentials, sampling and CA-bundle fixture overrides out of tests.
for P2_NAME in $(compgen -v OTEL_); do unset "$P2_NAME"; done
unset AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN \
  AWS_CONTAINER_CREDENTIALS_RELATIVE_URI AWS_CONTAINER_CREDENTIALS_FULL_URI \
  ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN OPENAI_API_KEY \
  AWS_CA_BUNDLE REQUESTS_CA_BUNDLE
export AWS_EC2_METADATA_DISABLED=true LITELLM_LOCAL_MODEL_COST_MAP=True \
  PYTHONDONTWRITEBYTECODE=1 MERI_REVIEW_SOURCE_ROOT="$PWD" \
  MERI_TEST_PYTHON="$P2_PYTHON"
export PATH="$(dirname "$P2_PYTHON"):$PATH"
shopt -s nullglob
P2_NODE=(node --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap)

"${P2_NODE[@]}" apps/proxy/product/*.test.mjs apps/proxy/product/test/*.test.mjs
"${P2_NODE[@]}" apps/runtime/telemetry/test/*.test.mjs
"${P2_NODE[@]}" apps/gateway/model-proxy/*.test.mjs apps/gateway/budget/*.test.mjs \
  apps/runtime/native-authority/test/conversation-currentness.test.mjs
"${P2_NODE[@]}" infra/product-preview/*.test.mjs infra/product-preview/first-chat/*.test.mjs

P2_RUNTIME=()
for P2_TEST in apps/runtime/test/*.test.mjs; do
  case "${P2_TEST##*/}" in
    d3-rehearsal.test.mjs|first-turn-rehearsal.test.mjs|image-closure.test.mjs|prepared-candidate-bootstrap.test.mjs|remote-conversation-runner.test.mjs) ;;
    *) P2_RUNTIME+=("$P2_TEST") ;;
  esac
done
"${P2_NODE[@]}" "${P2_RUNTIME[@]}"
# Separate bounded host attempts (not the Docker image gate).
timeout --kill-after=10s 300s "${P2_NODE[@]}" apps/runtime/test/prepared-candidate-bootstrap.test.mjs
timeout --kill-after=10s 300s "${P2_NODE[@]}" apps/runtime/test/remote-conversation-runner.test.mjs
"${P2_NODE[@]}" apps/runtime/native-authority/test/next-turn-admission.test.mjs \
  apps/runtime/native-authority/test/native-restorer-pg.test.mjs
"${P2_NODE[@]}" apps/worker/conversation/test/*.test.mjs
"${P2_NODE[@]}" apps/control/conversations/test/load-amplification.test.mjs \
  apps/control/conversations/test/startup-composition-latency.test.mjs
"${P2_NODE[@]}" packages/contracts/test/*.test.mjs
npm run typecheck --prefix apps/runtime

# One module per process; do not overlap this with owner Node TLS suites (port 8444).
for P2_TEST in apps/proxy/product/test/test_*.py apps/proxy/product/test_*.py \
  apps/proxy/qualification/test/test_*.py; do
  P2_MODULE="${P2_TEST%.py}"
  timeout --kill-after=10s 300s "$P2_PYTHON" -B -m unittest -v "${P2_MODULE//\//.}"
done
```

The collected matrix used equivalent bounded subprocess calls, recording every expanded argument array, exit code, duration, test name, failure and skip in JSON. The other Node groups had maximum bounds of 10–30 minutes; all finished within them. The pinned proxy image, Docker image gate, Docker COPY closure and first-turn/D3 rehearsals were not run.

</details>

<details><summary>All 72 failures, with base and head results</summary>

| Suite | Test | Base | Head |
| --- | --- | --- | --- |
| contracts | generated distribution check is independent of caller working directory | fail | fail |
| contracts | initial-input generation records exact canonical provenance and one shared browser import | fail | fail |
| contracts | input-only generation records exact canonical provenance and one shared browser import | fail | fail |
| control | 300 ms Core responses cross load, runtime, status and native prepare/start before the model | fail | fail |
| infra | assembled runtime.json renders all five roles through every render-material validator with throwaway PKI | fail | fail |
| infra | no features (absent or {}) renders byte-identical material and summary to the reviewed render at BASE | fail | fail |
| infra | runtime values: the capability profile reaches the measurement and the assembled pin; without the feature nothing changes | fail | fail |
| rebase-regressions | actual canonical SQL UNKNOWN restoration cannot repeat filesystem effects | fail | fail |
| rebase-regressions | actual canonical SQL admits a restoration claim for a run the worker already claimed starting, never once it is running | fail | fail |
| rebase-regressions | fork: actual canonical SQL restoration claim/readback and inode-preserving replay | fail | fail |
| rebase-regressions | resume: actual canonical SQL restoration claim/readback and inode-preserving replay | fail | fail |
| runtime | READS lookup never prepares or allocates; global control and missing/foreign entries cannot borrow authority | fail | fail |
| runtime | UNKNOWN original remains UNKNOWN until existing issuer reconciliation, never reminted | fail | fail |
| runtime | [posix-real-ca] a CA file owned by another uid is refused even at mode 0600 | fail | fail |
| runtime | absent or disabled configuration keeps the link routes closed, reads no key and leaves other document routes unchanged | fail | fail |
| runtime | accepted request change across preparation withholds entry after durable issuance | fail | fail |
| runtime | actual accepted request and fixed original expiry reach the SAME canonical issuer; recreated helper never remints | fail | fail |
| runtime | actual control listener mounts canonical opaque issuance, submit/history and task-authorized RPC | fail | fail |
| runtime | actual runner command composition consumes steering and canonically captures completed checkpoint | fail | fail |
| runtime | actual runner completion route refuses current authority instead of fabricating completion | fail | fail |
| runtime | actual runner native capture refusal leaves pause unverified, retains UNKNOWN control and fails the hold explicitly | fail | fail |
| runtime | actual startControl default path reaches listener and closes only its own resources | fail | fail |
| runtime | actual startControl direct path reaches listener and closes only its own resources | fail | fail |
| runtime | actual startControl factory path reaches listener and closes only its own resources | fail | fail |
| runtime | actual startControl prepared path reaches listener and closes only its own resources | fail | fail |
| runtime | already allocated static original never receives retrofitted canonical material | fail | fail |
| runtime | an original becoming statically allocated during preparation withholds the new entry | fail | fail |
| runtime | an unreadable or short signing key keeps the gate closed after the store is verified | fail | fail |
| runtime | apps/runtime/test/original-run-facts.test.mjs | fail | fail |
| runtime | assembled multi-run registry receives the same injected HTTP transport as first-run and Core authority | fail | fail |
| runtime | canonically issued allocated original replays only exact existing grant/facts/allocator identity | fail | fail |
| runtime | changed request under original issuance refuses without new material | fail | fail |
| runtime | claim is an atomic absent-row insert from two connections; the same run with a different binding collides; a different intent for the key is refused; the fence binds completion; identity and facts are immutable in the adapter and the trigger | fail | fail |
| runtime | cli passes exactly installation {enabled, measurement, measurementSha256, revokedOperations} and discovery {enabled, capabilityPolicy} to the reads composer | fail | fail |
| runtime | compiled startup factory receives the same owned pool/native before readiness and listener | fail | fail |
| runtime | disabled installation and discovery pass their toggles only; absent blocks pass no key; discovery without capabilityPlatform is refused by configuration | fail | fail |
| runtime | each missing owner keeps the gate closed with its own reason and never reads the signing key | fail | fail |
| runtime | isolated runner invokes canonical activity and one scripted SDK query, preserving durable events | fail | fail |
| runtime | joint original startup uses actual accepted request, fixed expiry, canonical task/model facts and same registry session owner | fail | fail |
| runtime | model-proxy root init stages, verifies and hands files and directory to 10001:10001 | fail | fail |
| runtime | mount captures original preadmitted data and issues an actual action session through canonical product SQL | fail | fail |
| runtime | mounted SDK registration joins current product allocation with the borrowed verifier and registration reader | fail | fail |
| runtime | one actual factory flow completes inbox output then cancels future firings without inventing an active target | fail | fail |
| runtime | one actual factory flow publishes partial inbox output then explicitly cancels and retires its real job | fail | fail |
| runtime | one scripted SDK query obtains its first mirror key and settles before durable completion | fail | fail |
| runtime | parent cancellation retains actual control HTTP through ordered original candidate cleanup | fail | fail |
| runtime | precompiled borrowed owner is captured before asynchronous startup and retains its receiver | fail | fail |
| runtime | prepared startup composes supplemental direct membership without replacing canonical identity | fail | fail |
| runtime | prepared startup composes supplemental factory membership without replacing canonical identity | fail | fail |
| runtime | proxy configuration is validated inside the plan with the Python startup rules | fail | fail |
| runtime | public Stop after a cold restart retires the failed original despite Temporal NOT_FOUND, without new authority | fail | fail |
| runtime | public Stop after a cold restart retires the running original despite Temporal NOT_FOUND, without new authority | fail | fail |
| runtime | public Stop preserves UNKNOWN on grant revocation failure; a repeated Stop after restart cleans up without redispatch | fail | fail |
| runtime | public candidate mounts actual issuance and queued submit before lazy allocation, and private readiness is control-only | fail | fail |
| runtime | public mounts are exact and both applications remain excluded from the protected listener | fail | fail |
| runtime | recomputed original expiry conflicts and expired original cannot reach a port | fail | fail |
| runtime | relay executes canonical task-authorized load/publish and denies foreign/revoked tasks before further durable effects | fail | fail |
| runtime | remote runner constructs the canonical native client from bootstrap config and TASK credential when no borrowed port exists | fail | fail |
| runtime | remote runner retains passive read port through existing execute boundary (false) | fail | fail |
| runtime | remote runner retains passive read port through existing execute boundary (true) | fail | fail |
| runtime | runner preserves exact observed key, strips private selector and closes owned mirror | fail | fail |
| runtime | runner refuses missing observed registration before the single SDK query | fail | fail |
| runtime | scripted success without first mirror cannot produce durable completed state | fail | fail |
| runtime | static original or changed accepted input cannot receive new canonical authority, stop-only never issues | fail | fail |
| runtime | stopOnly refuses before every owner port, including an absent original | fail | fail |
| runtime | the issuer over the durable adapter: concurrent callers share one generation; restart replays without generating; a separate OS process that claimed and completed is recognized; a lost completion stays UNKNOWN until the authority answers; no raw material reaches the row | fail | fail |
| runtime | uncertain observed SDK mirror prevents durable completed status and releases no success | fail | fail |
| runtime | verified owners open the gate before the listener; the key is read once through readSecret and the routes reach the link application | fail | fail |
| worker | a browser cleanup that cannot be verified surfaces as SDK_CLEANUP_UNKNOWN instead of a clean completion | fail | fail |
| worker | a configured browser port is asked for the run policy, composes nothing while held, and its cleanup runs after a completed run | fail | fail |
| worker | browser cleanup also runs when the run fails, and a refused browser policy fails the run before any query | fail | fail |
| worker | the early read ledger follows the run's admitted maxToolCalls below and above the default, and keeps 20 without one | fail | fail |

The four native-restorer PostgreSQL cases fail equally on base and head with EPERM connecting to their default local Unix socket; they do not implement an absent-engine skip. Proxy PostgreSQL engine cases require disposable PostgreSQL; no PostgreSQL binaries are installed. The infra material-write deadline case requires nonroot UID 1000 and writable `/run`; this host maps only UID 0. The unsupported verified-chain API test correctly skips because Python 3.13 has that API.

The 23 unchanged skips are 20 proxy PostgreSQL engine cases, one proxy unsupported-API negative case, one infra PostgreSQL case, and one infra material-write case requiring UID 1000/writable `/run`. No PostgreSQL engine validation is claimed.

</details>

<details><summary>75 isolated mutation checks: exact edits and failed assertions</summary>

**75 isolated behavioral mutation kills.** Edits were isolated and reverted. Coverage is for these counterexamples, not every test or branch. Counts: Python pair/transport 27, admission 11, bridge 7, Node pair 9, Node discovery 7, owner read cleanup 5, request work 3, recovery 2, reserve join 1, composed counts 3.

Commands are repo-relative. `python` is locked host CPython 3.13 with `AWS_EC2_METADATA_DISABLED=true`, not pinned-image qualification. Append Python methods to their module/class; Node selectors are unique name prefixes. All mutants exited 1; unmodified tests passed.

**Python pair, discovery and transport — 27 kills**

Commands: `python -B -m unittest apps.proxy.product.test.test_pair_lease.LeaseTests.<method>` or `python -B -m unittest apps.proxy.product.test.test_owner_https.HttpsTests.<method>`.

Test keys (P = `test_pair_lease`; H = `test_owner_https`):

- P1: `test_lease_checks_monotonic_expiry_even_after_wall_steps_and_renewer_starvation`
- P2: `test_post_handshake_proof_is_fresh_and_checks_complete_socket_identity`
- P3: `test_replacement_closes_generation_before_install_and_needs_fresh_socket_proof`
- P4: `test_own_replacement_old_partner_return_and_backward_created_at_retire`
- P5: `test_fourth_reproof_within_rolling_ten_minutes_retires`
- P6: `test_unsettled_discovery_is_quarantined_and_recreated_only_after_cooldown`
- P7: `test_unavailable_renewal_preserves_old_lease_then_one_bounded_sync_proof`
- P8: `test_partial_service_task_and_eni_replies_cannot_hide_observed_drift`
- P9: `test_renewal_schedule_subtracts_discovery_and_warmup_duration`
- H1: `test_each_new_socket_proves_after_handshake_before_any_http_bytes`
- H2: `test_fourth_actual_carrier_reset_retires_but_duplicate_reset_does_not`
- H3: `test_read_timeout_resets_only_its_carrier_then_next_request_serves`
- H4: `test_replacement_connect_failures_do_not_spend_sent_carrier_reset_quota`
- H5: `test_post_handshake_reused_ip_and_eni_do_not_admit_a_foreign_service_task`
- H6: `test_post_handshake_two_distinct_running_members_send_no_http_bytes`
- H7: `test_post_handshake_final_membership_and_deployment_pins_send_no_http_bytes`
- H8: `test_post_handshake_changed_task_definition_and_image_are_never_repinned`

Unqualified source names are under `apps/proxy/product/`.

| Source | Mutation | Failed test |
|---|---|---|
| `pair_lease.py` | `self._mono() >= lease.expires_at_mono_ms` → `False` | P1 |
| same | `fresh = self.renew(deadline_ms=deadline_ms)` → `fresh = self.current` | P2 |
| same | Remove `fresh.owner.ip != owner_ip or fresh.proxy.ip != proxy_ip` | P2 |
| same | `self._lease = None` before close callbacks → `pass` | P3 |
| same | `proxy != own` → `False` | P4 |
| same | `owner.task_arn in self._seen` → `False` | P4 |
| same | `owner.created_at_ms < old_owner.created_at_ms` → `False` | P4 |
| same | `len(self._reproofs) >= PAIR_REPROOFS_PER_10_MIN` → `False` | P5 |
| same | `self._mono()-self._reproving_since < PAIR_REPROOF_MS` → `True` | P3 |
| same | `self._mono() < self._quarantine_until` → `False` | P6 |
| `service_pair_discovery.py` | Exception classification `_unavailable()` → `_drift()` | P7 |
| `owner_https.py` | Post-handshake `self.pair_lease.prove_socket(...)` → `None` | H1 |
| same | `exceeded = len(self._resets) > CARRIER_RESETS_PER_MIN` → `exceeded = False` | H2 |
| same | Add `self.abort()` before raising transport-unavailable on timeout | H3 |
| same | `connection.auto_open = 0` → `1` | H1 |
| `service_pair_discovery.py` | Before observing service rows, add `if type(rows) is list and len(rows) < 2: _unavailable()` | P8 |
| same | Add the same early bailout for task rows | P8 |
| same | Add the same early bailout for ENI rows | P8 |
| `owner_https.py` | Reset-quota `if sent:` → `if True:` | H4 |
| `pair_lease.py` | Renewal delay `-(self._mono()-began)` → `-0` | P9 |
| `service_pair_discovery.py` | `t.get('group') != 'service:'+p['serviceArn'].split('/')[-1]` → `False` | H5 |
| same | `t.get('startedBy') != deployment` → `False` | H5 |
| same | `for v in values:` → `for v in values[:1]:` | H6 |
| same | Final comparison `last != first` → `False` | H7 |
| same | `(owner_again, proxy_again) != (ids['owner'], ids['proxy'])` → `False` | H7 |
| same | `t.get('taskDefinitionArn') != p['taskDefinitionArn']` → `False` | H8 |
| same | `c.get('imageDigest') != p['imageUri'].split('@')[1]` → `False` | H8 |

**Admission lease — 11 kills**

Command: `python -B -m unittest apps.proxy.product.test.test_owner_admission.AdmissionLeaseTests.<method>`.

- A1: `test_receipt_reuses_only_in_its_lifetime_with_no_request_path_reads`
- A2: `test_monotonic_ten_second_cap_survives_wall_clock_steps_and_starved_watch`
- A3: `test_receipt_expiry_shorter_than_ten_seconds_is_the_cap`
- A4: `test_receipt_source_and_runner_peer_remain_bound`
- A5: `test_unanswered_renewal_preserves_only_the_unexpired_receipt`
- A6: `test_answered_refusal_cuts_immediately_without_poisoning`
- A7: `test_late_renewal_cannot_revive_a_lease_after_monotonic_expiry`
- A8: `test_late_answered_refusal_cuts_even_after_a_short_wait_returned_unanswered`
- A9: `test_generation_change_closes_old_admission_even_with_valid_receipt`

| Source | Mutation | Failed test |
|---|---|---|
| `owner_admission.py` | `owner is not None and (lifetime is None or owner() is not lifetime)` → `False` | A1 |
| same | `min(ADMISSION_LEASE_MS, frame[7] - at)` → `frame[7] - at` | A2 |
| same | Remove `not receipt.read_at_mono <= self.monotonic() < receipt.expires_at_mono` | A2 |
| same | `min(ADMISSION_LEASE_MS, frame[7] - at)` → `ADMISSION_LEASE_MS` | A3 |
| same | Remove `life.admission.authority._product_owner != (self, state.source, state.expires_at_ms)` | A4 |
| same | Remove `self._peer(life) != state.peer` | A4 |
| `apps/proxy/qualification/runtime/lifetime.py` | `if self._owner_reader is not None and self._unanswered(error):` → `if False:` | A5 |
| same | `return (isinstance(error, (TimeoutError, ConnectionError, OwnerCarrierBusy)) or isinstance(error, PairProofError) and error.code == "PAIR_UNAVAILABLE")` → `return True` | A6 |
| `owner_admission.py` | `_consume(previous, json.loads(state.source), lifetime=life)` → `pass` | A7 |
| same | `loop.call_soon_threadsafe(life.deny, "FRESH_ADMISSION_DENIED")` → `pass` | A8 |
| same | Generation-close guard `if generation != self.generation:` → `if True:` | A9 |

**Python bridge — 7 kills**

Command: `python -B -m unittest apps.proxy.product.test.test_owner_channel.OwnerChannelTests.<method>`; source `owner_channel.py`.

- B1: `test_read_only_open_timeout_resets_then_next_request_uses_fresh_carrier`
- B2: `test_reserve_timeout_retains_unknown_and_never_retries_reserve`
- B3: `test_settle_timeout_preserves_unknown_then_reads_outcome_on_fresh_carrier`
- B4: `test_generation_check_refuses_even_before_close_notification_arrives`
- B5: `test_generation_change_invalidates_old_bridge_and_source_before_new_request`
- B6: `test_unavailable_settlement_readback_refuses_only_its_request`

| Mutation | Failed test |
|---|---|
| `result = self.exchange.reset(channel)` → `result = None` | B1 |
| Remove `self._state != "NEW"` from reserve guard | B2 |
| `if self._sent and self._generation_current():` → `if False:` | B3 |
| `return (self.generation == self.exchange.generation and self.policy == self.exchange.policy)` → `return True` | B4 |
| `bridge._invalidate_generation()` → `pass` | B5 |
| `current[5].clear()` → `pass` | B5 |
| Add `self.host_gate.poison()` when setting request state FAILED | B6 |

**Node pair holder — 9 kills**

Command: `node --test --test-reporter=tap apps/proxy/product/owner-pair-lease.test.mjs`; source `owner-pair-lease.mjs`. Failed test prefixes:

- N1: `no valid lease means no exchange`
- N2: `new sockets require a full proof started after their handshake`
- N3: `replacement closes old sockets and sessions first`
- N4: `own task retires and cannot be re-pinned`
- N5: `older replacement retires and cannot be re-pinned`
- N6: `a previously seen partner ARN returning is drift`
- N7: `a fourth replacement in a rolling ten minutes retires`

| Mutation | Failed test |
|---|---|
| Remove `mono>=lease.expiresAtMonoMs` | N1 |
| `const result=await read({deadlineMs:r.deadlineMs,signal:r.signal});` → `const result=before;` | N2 |
| `notify('replacement',old);` → `void old;` | N3 |
| `identity(pair.owner)!==ownIdentity` → `false` | N4 |
| Remove `pair.proxy.createdAtMs<partnerIdentity.createdAtMs` | N5 |
| `seenPartners.has(pair.proxy.taskArn)` → `false` | N6 |
| `reproofs.length>=PAIR_REPROOFS_PER_10_MIN` → `false` | N7 |
| Remove `value.generation!==generation` and `value.generation!==lease.generation` | N3 |
| Remove `r.remoteAddress!==before.proxyPrivateIpv4Address` | N2 |

**Node discovery — 7 kills**

Command: `node --experimental-test-module-mocks --test --test-reporter=tap apps/proxy/product/service-pair-discovery.test.mjs apps/proxy/product/service-task-leases.test.mjs`; source `service-pair-discovery.mjs`.

D1–D6 are exact generated test names `post-handshake canonical proof retires for <case> before admitting an exchange`, with these cases:

- D1: `two distinct RUNNING proxy tasks`
- D2: `reused IP and ENI on a task outside the pinned service`
- D3: `changed partner task definition`
- D4: `changed partner image digest`
- D5: `deployment drift in the final service read`
- D6: `membership drift in the final service inventory`

| Mutation | Failed test |
|---|---|
| Remove `if(ids.size>1)drift();`; `if(ids.size!==1)drift();` → `if(ids.size<1)drift();` | D1 |
| Remove `task.group!=='service:'+p.serviceArn.split('/').at(-1)` | D2 |
| Remove `task.taskDefinitionArn!==p.taskDefinitionArn` | D3 |
| Remove `c.imageDigest!==p.imageUri.split('@')[1]` | D4 |
| Remove `last.owner.deploymentId!==first.owner.deploymentId` and `last.proxy.deploymentId!==first.proxy.deploymentId` | D5 |
| Remove `ownerAgain!==ownerId` and `proxyAgain!==proxyId` | D6 |
| `if(!Array.isArray(rows))unavailable();` → `if(!Array.isArray(rows)\|\|rows.length<2)unavailable();` | `partial {services,tasks,ENIs} cannot hide observed {owner,proxy} drift or keep its old lease usable` (six cases: expected PAIR_DRIFT, got PAIR_UNAVAILABLE) |

**Owner read cleanup — 5 kills**

Command: `node --test --test-name-pattern='<prefix>' apps/proxy/product/<suite>.test.mjs`.

| Source/suite | Mutation | Failed test prefix |
|---|---|---|
| `product-owner-facts` | `new PostgresBudgetStore(work.pool,` → `new PostgresBudgetStore(c.pool,` | `stalled canonical issuance SELECT evicts` |
| `owner-native-currentness` | `make(binding,work.pool)` → `make(binding,c.pool)` | `cancelled currentness evicts` |
| `product-owner-placement` | `createInitialRunBindingJournal({pool:work.pool,now:c.now})` → pool `c.pool` | `aborted placement discards` |
| `owner-credential-delivery` | Remove `void state.stop().catch(()=>{});` from late closed/aborted-response branch | `a native response arriving after timeout` |
| `owner-native-currentness` | `finally{bytes?.fill(0);}` → `finally{}` | `foreign requested binding is denied` |

**Owner request work and outcome recovery — 5 kills**

Commands: `node --test apps/proxy/product/owner-request-work.test.mjs`; `node --experimental-test-module-mocks --test --test-reporter=tap apps/proxy/product/owner-outcome-cancel.test.mjs`.

| Source | Mutation | Failed test |
|---|---|---|
| `owner-request-work.mjs` | `if(outstanding.some(record=>record.dirty\|\|record.mutating))onUnresolvedMutation();` → `if(false)...` | `unresolved mutation and transaction commit poison; capture and reads do not` |
| same | Late checkout `if(closed){try{client.release(stopped());}catch{}throw stopped();}` → `if(false){...}` | `a late checkout after cancellation is discarded before any statement` |
| same | `if(readOnly&&writes)throw Error('PRODUCT_OWNER_READ_ONLY');` → `if(false)...` | `read-only recovery cannot issue a write even on a fresh client` |
| `owner-channel.mjs` | `signal?.addEventListener('abort',onAbort,{once:true});` → `void signal;` | `aborting recovery evicts its read client and keeps the service serving` |
| same | `exact(parseOwnerWire(raw(body)),['meri.proxy.operation/1',id,['meri.proxy.outcome/1',requestId]]);` → `void body;` | `a cancelled recovery and foreign recovery selectors never acquire a client` |

**Reserve transaction join — 1 kill**

Command: `node --test --test-reporter=tap --test-name-pattern='archive during the leased budget read rolls back before inserting a model hold' apps/gateway/budget/product-model-budget.test.mjs`.

In `apps/gateway/budget/product-model-budget.mjs`, delete the second `limitDeadline(await currentConversation(c.checkCurrentConversation,selected,c.selectedClientId,{...v,deadlineMs:Math.min(v.deadlineMs,current.deadlineMs)},c.now,c.limits.maxRequestMs));`. The named test changes from pass to `Missing expected rejection`, proving removal permits a hold after the mid-transaction archive.

**Real Python↔Node TLS counts — 3 kills**

Command: `python -B -m unittest apps.proxy.product.test.test_pair_lease_composed.ComposedPairLeaseTests.test_twenty_second_request_reuses_warm_pair_and_request_proofs`.

Baseline: 20.2 seconds, four watch renewals, 13 owner exchanges, zero request-attributed pair discoveries on either side, and 12 owner Core joins. The test catches all three edits:

| Source | Exact change | Observed assertion failure |
|---|---|---|
| `owner_https.py` | Insert `self.service_pair_reader.read(deadline_ms=cutoff)` before held-socket `pair_lease.require(...)` | 130 proxy SDK calls ≠ 0 |
| `owner-https.mjs` | Request `await c.taskLeaseReader.ensure({deadlineMs:deadline,signal:abort.signal});` → `.read(...)` | 13 owner pair proofs ≠ 0 |
| `owner_startup.py` | Session `await life.refresh()` → `await life.renew()` | 6 peer checks ≠ 5 |

</details>

Verification notes: the unchanged worker-retention scoped-read deadline case returned 403 instead of 408 in one broad head run and one targeted head rerun. A sibling acquisition deadline case failed on both original base and head targeted runs. The final full base96/head matrix passed both deadline cases and matched every failing test. No source changes were made for these timing observations; original logs remain retained.

Initial environment and stale-fixture failures were corrected before the final matrix. An early cancellation mutant exposed an assertion that waited until the deadline; it was strengthened to require immediate abort eviction. An invalid discovery-mutant attempt using a stale adapter was excluded and all seven discovery mutants were rerun from a fresh frozen checkout. The 75 reported kills are behavioral assertion failures against passing unmodified tests.

