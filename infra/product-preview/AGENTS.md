# Preview infrastructure instructions

Apply root AGENTS.md and the pinned 20261022 handover. Codex owns shipping; agent 2 owns only explicitly briefed infra input files. A shared renderer, contract, migration or config edit requires exact file/phase ownership.

Use a real Git checkout, MERI_REVIEW_SOURCE_ROOT, node_modules/@capiro workspace links and Python cryptography >=42. Read test dependencies before running a targeted Node module. Use isolated PG16/throwaway PKI; no live or clone database test connections.

Never execute a kit to inspect arguments. Snapshot before authorized forward migration of the one persistent clone; no deletion/re-clone. Historical reclone.sh is forbidden even if present in an old handover. Core and the entire runtime cut over together. Preserve flags, TLS, SG allowlist and credential ownership. Steps 16–19 are one foreground sequence; owner/proxy restart only together. Wave 1 remains with its current owners and Wave 2 has not started.
