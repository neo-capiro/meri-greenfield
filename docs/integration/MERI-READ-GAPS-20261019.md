# Source-verified read gaps and receiving result

Inspected base: Meri `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`. Core producer inspection: `138c04373b18bb730b1ad0f8f9338342f628b8c6`. Final coherent source/test integration: `3751b35326aef3169cef98a16d2c1d7ba502c043`. These are source facts, not deployment or live availability.

The common chain is `retrieval-0.2/catalog.json` → `worker/conversation/reads/families.mjs` and capability policy → `reads/availability.mjs` / `reads/runtime.mjs` (`meri_reads`) → runtime `cli.mjs` / `reads-composer.mjs` / `selected-task-ports.mjs` → `gateway/general-reads/integration.mjs` → gateway dispatch/current authority/reservation → family adapter → existing Core endpoint → canonical `normalizeInput` / `assertOutput` → current-authority recheck and settlement/release. A skill can narrow this chain; an ordinary conversation can use it without selecting a skill. No registry addition qualifies a source.

| Operation | Verified base gap | Receiving source | Authorization / external dependency |
| --- | --- | --- | --- |
| `get_research_portfolio` | Existing handler and signed retained owner; absent selected startup | Composed via existing retained principal chain | Explicit public issuer/key/recipient pins, enabled Core receiver and actual current portfolio grant |
| `get_research_portfolio_changes` | Same | Composed; original cursor/limit preserved | Same, current resource revision throughout page |
| `get_research_evidence` | Existing GET adapter and task port; absent startup | Composed with distinct attended Bearer callback | Actual current user session and Core viewer grant; ordinary GET is not Option B |
| `read_monday_client_boards` | Existing signed adapter required an unexported mapping receipt; relay refused | Composed; exact signed Core mapping owner reused | Core checks actual actor/client/managed boards before and after read; no invented mapping endpoint |
| `mail.list_messages` | Signed Core/Meri adapter exists; no trusted mailbox admission or durable context | Conditional task port implemented; excluded from production selected composer | Server-owned admitted mailbox scope plus durable mailbox/folder/continuation owner and matching delegated authority |
| `mail.search_messages` | Same | Same; native bounded pagination retained | Same |
| `mail.read_thread` | Same | Same; exact thread/body-window contract retained | Same |
| `get_florida_budget_project` | Existing signed Intel adapter and Core authority owner; absent startup | Composed via existing retained principal chain | Core/Intel trust pins and receivers, FL session/folder/client authority |
| `query_tasks` | Existing source; selected composer explicitly refused it; original dispatcher omitted invocation | Composed with exact flat body-bound one-use Option B token | Selected-client task only; current Core membership/client/portfolio-task grants |
| `search_research_sources` | Canonical contract, no adapter | New finite native adapter, trusted client context and general registration | Core Option B allowlist admission; actual source/client/directory-note authorization qualification |
| `read_chat_attachments` | Contract only in Meri; real legacy Core producer | Blocked; no unusable adapter added | Actual greenfield→native conversation/current-turn/byte custody, observation clock contract, Core delegated admission |
| `get_certification_status` | Contract only; producer has implicit locale | Blocked | Producer-consumed canonical comparison locale and delegated admission |
| `get_state_rule_status` | Contract only; producer has separate implicit clocks | Blocked | Producer-consumed stage/comment observations and delegated admission |
| `search_sam_opportunities` | Contract only; producer has independent freshness clocks/mode | Blocked | Producer-consumed generation/staleness/health clocks and policy mode, delegated admission |
| `search_legiwatch_news` | Native adapter exists, omitted general policy family | Registered in general discovery | Supported exact-source/personnel-with-explicit-year slice only; implicit windows/monitor context remain unavailable |
| `get_legal_reference` | Adapter exists, omitted policy operation subset | Registered | Parser-independent rules/versions/explicit-ID slice only; unavailable citation parsing stays unavailable |
| `query_outreach` | Adapter exists, omitted policy family | Registered, selected-client required | Explicit-client campaign-list slice; detail/linked-resource expansion remains unavailable |
| `get_business_development_evidence` | Canonical contract and actual Core dossier producer; omitted native source/policy subset | New selected-client, signed-only native adapter and general registration | Core allowlist admission and actual native conversation/prospect/linked-client custody; no personal/Bearer fallback |

`search_memory` and `memory.list_own_proposals` were already selected-composed at the base. Their signed eligibility, durable continuation journal, source manifests and runtime relay remain in place. No production memory implementation was rebuilt. One obsolete cancellation fixture was repaired against the existing signed protocol.

Inventory reconciliation: Appendix A's 96 selected legacy capabilities includes more than reads; Appendix B's 43 deferred operations and the 14 plugin skills are separate sets. The base general source inventory was 76 operations / 42 families. This receiving source derives **81 operations / 45 families**: adds research-source search, legal reference, LegiWatch news, outreach query and BD evidence to source eligibility. The canonical catalog's 97 versioned descriptors are unchanged. These counts do not describe an active installation, the count of authorized operations on a run, or live capabilities.

Every source family still needs exact measured P2 installation, current P1 discovery, approved reads, allocation/budget and current actor/tenant/client/source authority. No active installation, G3 policy, image, deployment configuration, readiness flag or database was changed. A full desired inventory containing blocked mail is not an approved active set; the shipment owner must use an explicitly reviewed subset and qualify it.

Exact endpoint/producer paths and minimal Core proposals are in `CORE-READ-PRODUCER-MAP-20261019.md`, `SECOND-PACKAGE-PRODUCER-CONTRACTS-20261019.md`, `RESEARCH-FLORIDA-READS-HANDOFF-20261019.md`, `MERI-TASK-OMITTED-READS-20261019.md`, and the mail/Monday implementation handoff under `apps/runtime/native-authority/retained-reads/`.
