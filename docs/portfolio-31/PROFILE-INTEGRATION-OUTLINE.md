# Profile and debrief integration

Shared policy: `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; machine-map revision `2026-09-30T00:21:48.2698715Z`. Remote policy was freshly fetched without discarding the three local policy commits.

The integration owner composes the separately reviewed profile tag/export and voice-source interfaces into the existing Client Overview, profile menu and meeting debrief flow. Feature adapters retain data access, permission checks, receipts and mutation uncertainty; the route and presentation containers only select and render these interfaces. The canonical API client, identity cache, upload adapter, extraction adapter, Dialog and React Query invalidation remain their existing owners.

- Add FocusTags after the Overview description, before account ownership, matching inspected current Figma `411:47039` within `411:47010`.
- Add reviewed JSON export to the existing client profile actions menu, preserving explicit prepare/download and focus restoration.
- Keep the existing CSV import component in its test harness. On 11 October 2026 the user confirmed that CSV import is not required for the current Portfolio scope, so do not add a product entry or count CORE-018 toward release acceptance.
- Correct the Engagement pulse card surface and statistics spacing from inspected `411:47144`; retain current service values and explicit unavailable analytics. Do not invent 30-day, reply, overdue or weekly definitions.
- Compose the audio-file review interface into debrief generation with the verified `voice` method. No microphone capture, second uploader or external provider client.
- Keep product scope/actor state and ambiguous writes within feature sessions. Existing Clerk SessionBoundary clears the complete cache when the actual auth session changes.

Verification includes actual Overview/menu browser entry points, tag persistence receipt/cache refresh, explicit export/download and keyboard focus, light/mobile dark surface review, the existing affected activity and source regressions, type/lint/format/architecture, production build and production-server auth/deep-link checks. Intercepted browser evidence is synthetic; live signed-in acceptance and backend access/concurrency gaps remain separately qualified.

## Development review

The first integrated synthetic run passed all 22 profile-tool/browser cases and all 467 application unit cases; TypeScript passed. Three actual Overview/menu cases independently verify tag placement and intake preservation, an explicit exact-source download with no automatic download, Escape focus restoration, and mobile dark containment. Desktop/mobile screenshots were opened and inspected. These are development checks before the final source is frozen.

Cleanup reported only about 308 MB above its recovery-space requirement while native build `6278471a` remains active. No dependency installation or new production build allocation is being made during that run. Preview `5190` still serves the independently qualified `bbf25e6` build. A new source build and signed-in acceptance are not implied by component checks.
