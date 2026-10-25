# Current action sessions

`session/owner.mjs` owns the process-local opaque application session, its current Core identity/context, and the borrowed native credential. `session/http.mjs` exposes the existing issuance boundary. `current.mjs` remains the shared bounded current-state reader used by document and schedule owners.

Standalone task creation and update are composed by `apps/runtime/native-authority/standalone-tasks.mjs` through the existing task product family. They use current sessions, retained command custody, native Core approval/execution, and the canonical retention gate. No model turn is fabricated for first-use preparation.

The former action host, allocation/grant issuance adapters, qualified-application graph, and their synthetic launchers have been removed. Historical evidence remains in Git and qualification records.
