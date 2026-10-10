# Meri Figma missing-evidence extension

Read-only later live capture for the exact owned Meri section439:81406, page411:40601, fileZc2dEN5aLU47dVdsewDmiJ. Original accepted snapshot docs/design/meri/20261010T004355Z is unchanged. This extension is separate evidence and requires owner adoption before consumers treat it as a baseline update.

## Actual results

All18 exact referenced style IDs from the original inventory resolved successfully:15 TEXT,2 EFFECT,1 PAINT. Full IDs,keys,names,remote flag,bound-variable metadata and all documented type-specific definition fields are preserved in styles.json. Definitions report remote:false; this does not establish font-file licensing or redistribution rights.

| Captured text style | Font family / style | Size |
| --- | --- | --- |
| v2/Mono | Geist Mono / Medium | 12 |
| v2/Stat | Geist / SemiBold | 22 |
| v2/Title L | Geist / Medium | 20 |
| v2/Button | Geist / Medium | 14 |
| v2/Label | Geist / Medium | 12 |
| v2/Body | Geist / Regular | 14 |
| v2/Caption | Geist / Regular | 12 |
| v2/Display | Geist / SemiBold | 40 |
| v2/Lede | Geist / Regular | 15 |
| v2/Mono eyebrow | Geist Mono / Medium | 11 |
| v2/Title S | Geist / SemiBold | 14 |
| v2/Small | Geist / Regular | 13 |
| v2/Title | Geist / SemiBold | 15 |
| v2/Body medium | Geist / Medium | 14 |
| v2/Stat XL | Geist / SemiBold | 34 |

The other definitions are v2/shadow-xs, v2/metal-shadow and v2/metal-face. Their exact effect/paint arrays,including colors,opacity,gradient stops/transforms,radius/offset/spread and bindings,are retained without rounding.

Fresh dark frame448:89992 was captured with the documented runtime helper node.screenshot({scale:1,contentsOnly:false}),which returned a native inline PNG. No asset URL fetch or repeated MIME-failing download was attempted. The PNG is preserved as dark-448-89992.png with exact bytes,MIME,dimensions and hash recorded in capture-manifest.json. It was visually inspected: the content area and sidebar are dark; the shared top header remains light. Sample names,client labels and badge numbers are design fixture text,not live user/source state.

## Capture provenance and limits

Start owned-root metadata:2026-10-10T01:25:11.846Z. Styles:01:26:09.159Z and01:26:10.604Z. Dark screenshot:01:26:11.266Z–01:26:13.097Z. End owned-root metadata:01:26:23.924Z. All timestamps UTC. Exact raw connector responses,including native image bytes and scripts,are preserved; any remote URLs are redacted.

Start/end ordered direct-root metadata match. Manifest separately records comparison with original accepted root metadata. This only compares direct-root IDs,names,types,parents and local bounds. It does not detect nested content/style edits or establish an atomic capture. The connector exposed no immutable document revision/version. This later live capture cannot be silently folded into the earlier snapshot or claimed to share its revision.

No new capture attempt failed. The original single MIME-validation failure remains preserved in its original manifest and is referenced as historical evidence here. It was not overwritten or reclassified as success. No outside-section node traversal,global style-consumer query,style import,Code Connect setup,Figma edit,tracked edit,product code,network credential operation,AWS/provider call,tool install or deployment-gate work occurred.

Resolved evidence gaps are the18 referenced definitions and one local dark reference PNG. Full product reaction/control/overlay mapping,component implementation and parity,font/runtime availability,theme switching,contrast/accessibility and application behavior remain unqualified. This extension claims no functional pass or gate advancement.

