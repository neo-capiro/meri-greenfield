# P0 telemetry implementation

Base: `69fd19945c6f9255577d58d9fee01385f0cc6526`; branch: `feat/meri-p0-telemetry`.

The supplied P0 plan and hot-path/Core ADRs are design inputs. This PR implements P0 only. Authentication, runtime budgets, retry behavior, wire contracts, OTel, and deployment remain unchanged. No AWS credentials or commands are required or used.

## Ownership and implementation outline

- Shared Node telemetry owns closed event schemas, redaction, EMF encoding, failure classification, bounded run/background counters, contextual attribution and identity-preserving I/O counting wrappers. Existing OTel is independent.
- Control owns admission timestamps and durable-publication observations. Runner owns its stage/failure twins and run-owner HTTP counts. Context is attached to existing validated bindings without new authority reads.
- Owner owns settlement counters, budget quarantine and health transitions. Proxy owns model request timings, exchanges, AWS counts and Python EMF output through the existing raw diagnostic descriptor.
- A standalone observability stack owns metric filters, alarm math, dashboard and SNS. Existing application stacks retain their resource boundaries.
- Test-only CI builds pinned public images, runs the existing image gate and rehearsals, and compares candidate failures with the same suites on the base. It does not deploy or publish images.

Modules depend on the telemetry layer; telemetry never calls application services, databases, AWS or exporters. Initialization is explicit, timers are unreferenced and closed by their owner, and telemetry failures must never change application results or errors.

## Reconciliations discovered while implementing

1. EMF cannot put different values of the same metric name into several status dimensions in one JSON record. Bounded `meri.core.counters` records therefore publish status-class slices; the original aggregate event remains once per flush. Status classes are exclusive, so 503 is not also counted as 5xx. `StatusClass` and `Attribution` are required dimensions despite their omission from the plan's initial dimension list. Background rollups contribute to the Service-only aggregate and also expose a separate `Attribution=background` series. Status slices follow the same rule. Alarm totals use the Service-only series; adding its background series again would double-count that work.
2. Health metrics include both service and service/component dimension sets, allowing the alarm to sum all owner/proxy transitions without a dynamic metric search.
3. CloudWatch text filters cannot attach a constant Service dimension while retaining DefaultValue=0. The owner and proxy suppression filters retain separate names/log groups and publish the common undimensioned DiagnosticsSuppressed metric with DefaultValue=0.
4. Owner pre-reservation exchanges do not yet have a model request ID. Counters with a validated run binding remain run-attributed and are drained once into a settlement record. Work without a validated binding remains background. The PR does not add correlation headers or change wire shapes.
5. Existing source references are located by function. The actual PendingWork implementation is `apps/proxy/qualification/runtime/lifetime.py`; additional existing run-owner operations require context binding in `apps/runtime/prepared-run-registry.mjs`.
6. Observing only `service.publish` misses terminal writes owned by completion, cancellation and the run reconciler. Additive observers therefore consume the existing acknowledged journal result or the existing validated readback after a lost acknowledgement. Failed transactions and unproven readbacks produce no success observation. These hooks add no SQL, authority checks or physical capture, and the shared observer deduplicates repeated terminal evidence.
7. A runner can classify a timeout that control records under the unchanged generic `EXECUTION_FAILED` reason. `TimeoutFailures` is therefore emitted by both control and runner, and the zero-tolerance alarm watches both. These are failure signals, not a distinct-turn count: both sources may describe the same turn. The dashboard labels that overlap; use `runId` when counting distinct affected turns.
8. The supplied rehearsal reference of 224 median Core calls does not match the supplied base on this host. Both base and candidate measured 164: 32 for load, 88 across four publishes and 44 across eleven polls. The fixture now returns the complete journal publication shape and observes completion's durable terminal publication; these fixture corrections introduce no extra Core call or changed latency profile. Its telemetry total must equal the independent Core counter, rather than forcing the historical 224 reference.

## Verification and completion boundary

Required verification includes schema/redaction and failure mapping tests, identity-preserving wrappers, publication timing and Core-call equivalence, unchanged diagnostic tests, owner and Python suites, rendered-template parity, the 24-case nonroot image gate, first-turn and D3 rehearsals, and base/candidate failure comparison.

The execution environment has Node 24 and Python but no usable Docker runtime. Docker qualification is assigned to GitHub-hosted CI, with precise source and image pins captured as artifacts. A queued workflow or a host-only test is not image qualification. Any unavailable image, failed case, or incomplete run stays visible in the PR.

See [P0-VERIFICATION.md](P0-VERIFICATION.md) for local outcomes, same-base failures and remaining qualification gates. Existing owner Node tests are beside their modules in `apps/proxy/product/*.test.mjs`, so CI discovers that location as well as the plan's `product/test/` location. Supplemental material-renderer checks use a full Git checkout and synthetic PKI on a host runner because the runtime image lacks Git history; they do not replace the required image gate or rehearsals.

This work stops at one unmerged PR. The shipper owns stack application, SNS confirmation, deployment and live two-turn/dashboard acceptance.
