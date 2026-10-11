# Engagement pulse visual assertion

The frozen e7978a4 full component regression returned 349 passes and two failures.
The layout authority invalidation failure is corrected separately. The visual
failure expected a gradient on the entire Engagement pulse card.

Fresh Figma context from 11 October 2026, page Prototype — Capiro 3.1, Overview
411:47010 and component 411:47144, specifies `var(--card)` for that surface,
16px/20px padding and background-token stat cards. Its latest weekly bar uses a
dark gradient. The existing rendered card already follows those surface tokens.
No production styling was changed to satisfy this test.

The test now checks the exact current light and dark surface/stat colors and
spacing. The separate Meri gradient assertion remains. Original failing results,
screenshots and trace remain in the parent task's qualified-e7978a4 evidence.
This is an intentional assertion correction against current design evidence,
not a regenerated visual baseline or a claim that missing pulse analytics work.
