# SDK/proxy qualification blockers — 2026-10-18

Harness commit: `5fa5545898717e1148a28447bb93254a07fa6459` on
`qual/sdk-proxy-offline-20261018`, based on integrated source
`1fe6baaedbd410089907bed2e52b804ec28482ce`.

No production changes were made in this lane. The source commit contains only
the seven allocated qualification/test paths. Exact final commands and exit
codes are in `final-qualification-commands.json`; receipts name both source HEAD
and executable file hashes. Earlier unsuccessful setup and harness attempts are
retained separately and do not represent qualified paths.

| Gate | Confirmed evidence | Next owner work; no implementation in this commit |
| --- | --- | --- |
| SDK native request contract | Actual production defaults add cache controls, metadata.user_id, effort output config, empty tools and context/effort betas. Closed native contract refuses before count/reserve/provider. | `apps/worker/conversation/options.mjs` must explicitly constrain supported priced request behavior while preserving all selected tools and output schemas. `apps/proxy/qualification/runtime/bedrock_body.py` needs an explicitly reviewed closed contract for actual SDK fields. Do not strip translated fields or silently accept cache usage. |
| Metadata and tools | Captured metadata.user_id is 150-byte JSON with device_id/account_uuid/session_id string fields. Base tools array is empty. Objective JSON schema changes it into one synthetic tool under the global-betas-off experiment. | Review exact metadata bounds and semantics against primary provider contract. `tools:[]` is a separate closed-shape case; selected names/schemas require trusted source binding. Candidate composition owners are `apps/proxy/product/owner_startup.py` and `host_composition.py`, not a generic allow-all tool list. Existing default BodyLimits only names local_echo. |
| Global beta disabling breaks structured-output route | `sdk-configured` strips cache fields and effort body but retains effort beta. `sdk-constrained` capability overrides do not remove it on this gateway. Schema experiment emits a synthetic tool rather than native output_config.format. | Do not apply the global experimental-betas-off configuration as a production repair without proving actual SDK structured_result success and the existing Objective/skill validation contract. Root's primary-contract reviewer owns the design review. |
| SDK maximum-output hold and synthetic allocation | This harness reuses an original manifest with a 1000 microUSD budget. SDK's unchanged 8192-token cap would reserve 135248 microUSD; the canonical budget owner correctly refuses it. | A larger explicitly synthetic, internally consistent admission fixture is needed for a future admitted SDK positive case. Do not enlarge a production budget or blindly rewrite provenance. The separate minimal client uses 16 tokens, holding344 and settling90. |
| Actual owner HTTPS | Product requires distinct actual RFC1918 owner/proxy interfaces. Host exposes loopback only; private-address bind attempts fail errno99. No guard/network changes. | Execute on the approved shipping host with the required interfaces and genuine canonical HTTPS owner wire, both channels and actual endpoint checks. Private subprocess IPC receipts here cannot close this gate. |
| Storage/runtime/provider | SQL is existing scripted storage; CountTokens uses botocore Stubber; provider is in-process raw-frame HTTPX stub; currentness/ingress are synthetic. | PostgreSQL durability/isolation, genuine Core/ECS authority, shipping image and provider request acceptance remain UNRUN. No live DB, AWS or model call was attempted. |
| SDK retry after admitted UNKNOWN | Seven minimal-client native/accounting cases prove exact count/reservation/settlement/UNKNOWN behavior without duplicate stub execution. Default SDK never reaches admission. | Admitted SDK retry/unknown-ACK qualification remains OPEN until request contract and valid synthetic allocation are resolved. Do not equate zero-dispatch SDK retries with that positive qualification. |

The seven minimal-client cases execute the actual pinned LiteLLM native app,
canonical Python native guard/count/stream/settlement path, and actual JavaScript
reservation/settlement owners. Only transport, trusted ingress/currentness and
SQL storage boundaries are synthetic. All holds, pricing, refusals, commit-loss
classification and readback decisions come from the canonical owners.

Dependency setup used pure task-local CPython3.13.5 and109 accepted-lock Python
distributions; no repository/global dependencies changed. Unconstrained install
planning detected11 transitive version drifts and was never installed. Historical
3.12 and speculative extra-package attempts self-stopped at their disk budgets;
their failed logs remain present. Actual3.13 native startup and shutdown passed.
