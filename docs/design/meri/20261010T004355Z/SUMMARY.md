# Meri Figma scoped reference snapshot

Read-only discovery of file Zc2dEN5aLU47dVdsewDmiJ, page 411:40601, owned section 439:81406 (“19 · Meri · Standalone agent — complete product mockup”). Captured 2026-10-10 UTC. No Figma, application, source, AWS, or tracked repository edits.

## Measured inventory

| Classification | Count | Exact rule/evidence |
|---|---:|---|
| Direct owned roots | 115 | Direct children of section; ordered IDs, names and local bounds in inventory.json |
| Main frames | 85 | Direct FRAME children whose names begin NN.NN · |
| Overlay roots | 29 | Direct FRAME children named Overlay · |
| Review map | 1 | 439:81407 |
| State boards / state cards | 5 / 60 | Descendant FRAME names State · within exactly five 11.01–11.05 boards |
| Component families / variants | 15 / 70 | COMPONENT_SET / COMPONENT nodes, explicit IDs and property definitions |
| Walkthrough starts | 11 | Page flowStartingPoints filtered to owned-section IDs |
| Referenced variables / collections | 38 / 5 | Bound-variable references within owned subtree; definitions and actual modes captured |
| Reaction-bearing nodes / exact definitions | 2,214 / 118 | Scoped traversal; deduplicated exact JSON reaction arrays. Summary and destination pointers retained; full graph export incomplete |
| Home reaction-bearing nodes | 30 | 27 ancestor-visible; 3 hidden legacy header actions |

The scoped subtree contains 14,298 nodes including 3,512 FRAME nodes. Nested layout frames are not counted as main screens. All classification counts above have high structural confidence; they do not establish functional completeness.

## Visual reference

Local PNGs: Home 442:81437 (1440×1040), tablet conversation 448:90209 (1024×1100), phone Home 449:88256 (390×844). All three were visually inspected. Desktop Home uses a 232px sidebar, shared 64px header, centered prompt, recent conversation list and six suggestion/action cards; these are visual observations, not breakpoint implementation rules.

Dark workspace 448:89992 is 1440×1040. The screenshot tool returned metadata, but the single permitted asset download failed MIME validation; no local dark screenshot was saved or visually inspected. The dedicated “Meri · Dark theme” collection and its actual Dark mode are preserved.

Actual typography on Home includes Geist Medium/SemiBold/Regular and Geist Mono Medium, with exact per-text styles in inventory.json. Token definitions preserve collection IDs, variable IDs, keys, valuesByMode and WEB codeSyntax. Five collections each expose one mode; Dark uses a separate collection. No functional theme switching or font asset licensing/file availability was established.

## Home action findings

The complete Home reaction rows, labels, bounds and effective visibility are retained. Three old Search/Updates/Profile actions are hidden by a legacy header ancestor and must not be treated as visible controls.

The visible shared-header Brand, Portfolio, Modules, Search, Updates and Profile point outside the owned section. Only destination IDs were recorded; destination nodes were not traversed. These are prototype pointers, not application URLs, authentication proof or tenant/client handoff contracts. Owner D008 calls for an independent authenticated Meri entry point, future verified handoff, and disabled Portfolio/Modules until valid destinations exist.

Visible “New conversation”, active “Conversations”, and active shared-header “Meri” have no prototype reaction. PromptInput is a visual frame, not a live SDK input. Send and suggested actions navigate to canned prototype screens. Backend command/approval behavior cannot be inferred from these transitions.

## Capture integrity and limits

Figma’s documented Plugin API exposes apiVersion, which is not a file revision. No immutable document version/revision was available from the connector responses. Snapshot file hashes and per-response UTC timestamps provide a local reference baseline, not an atomic Figma revision.

An ordered root fingerprint assembled from captures at 00:43:55, 00:44:32 and 00:45:41 equals the later 00:48:37 root capture (IDs/names/types/parents/local bounds). This detects no direct-root drift during that interval. It does not detect nested content edits; no later final fingerprint was obtained after the owner stopped discovery. The last preserved metadata capture is the prototype summary at 00:54:02.

Oversized read-only responses encountered the connector’s 20,480-byte limit and are preserved as failures, not successful exports. Bounded later calls recovered the complete root/state/component/token inventories. The newly queued prototype graph pagination was cancelled at the owner’s stop request; no pages were retained. Only Home has full captured reaction definitions. Full control coverage, overlay interiors, 18 referenced style definitions, and application mapping remain later W00/W06 work.

Home get_design_context returned a Code Connect setup prompt rather than code/design context. No mapping was created and no design-to-code implementation was attempted. No prototype execution, frontend mount, cloud/provider call, source connection, sandbox qualification or deployment gate is established by this snapshot.

See inventory.json for normalized data; raw-connector-responses.json for exact preserved responses (screenshot URLs redacted); capture-scripts.json for read-only scripts; capture-manifest.json for hashes and provenance. Short-lived asset URLs are intentionally not persisted.

