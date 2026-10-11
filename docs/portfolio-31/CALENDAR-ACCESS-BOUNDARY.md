# Shared calendar access boundary

Library assignment, source extraction, debrief generation, saved documents and meeting attendance share the same current actor and runtime gates. The calendar access feature owns the canonical capabilities schema/query and asynchronous dispatch guard. Preparation retains its public query/schema aliases so existing consumers and the cache key remain compatible. No new endpoint, tenant flag or provider-readiness claim is introduced.

Routes and calendar features consume the public access interface; access depends only on shared API/auth and its own contract. The guard verifies successful, idle, non-invalidated identity, exact initiating actor/tenant, existing product role, component lifetime and (where required) current external-action capabilities before dispatch. Server authorization remains authoritative.

Verification: existing library/generation regression cases and full TypeScript, architecture, unit and browser gates run on the frozen integration source. Attendance adds its own contract and lifecycle checks before root composition. No live external action is part of this extraction.
