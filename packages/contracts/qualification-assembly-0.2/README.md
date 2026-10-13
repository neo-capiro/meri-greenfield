# Internal qualification lifecycle frames

`protocol.json` is the shared Python/Node vocabulary for a fixed owner-only process bridge. It is not an HTTP, browser, worker, provider or public package API. Native database configuration travels only in bounded child stdin. Receipts contain no database credentials, capability bearer, raw exception or worker read body.

Only the trusted Node coordinator consumes a one-use branded observation from the canonical predicate owner before invoking `activate`. Calling the Python owner is already privileged, just as calling canonical `Grants.activate` directly is privileged. A frame/hash is correlation, not proof of authority. No signing or new authentication protocol is introduced.

`prepare` calls canonical `set_current_run` then exactly two `create_pending`; `activate` calls one canonical activation; `inspect` performs fresh canonical grant admission checks; `revoke` calls canonical revocation. Readback/rehydration never seeds or binds a new allocation. Any partial setup or uncertain process/commit acknowledgement stops automatic progression. There is no retry/refund/implicit compensation. Explicit cleanup after the original deadline belongs to a separately authorized lifecycle owner; this bridge cannot extend that deadline.

The worker observation always reports `trusted-read-port-observation`, `predicatesPassed:true`, `runtimeQualified:false`. It proves evaluation of received bytes by this owner, not provenance of the transport. Scripted source tests are marked separately. Actual native verification requires the independently qualified read transport and owned runtime evidence. The prohibited historical image digest is rejected without changing accepted native-enforcement compilers.

The internal Python CLI supports `--help` (exit 0), `--stdio` with one bounded fixed frame (0 success, 2 refusal/unknown), and no other mode (2). There is no automatic migration or connection on help/import/invalid arguments. Focused tests explicitly cover CLI inertness; it is not a new generally discoverable application command.
