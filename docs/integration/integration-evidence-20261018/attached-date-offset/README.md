# Attached positive query-date offset correction

The exact user case `12:30 Jan 1 2020+0530` was wrong in published `b3611559`:12:30Z instead of07:00Z. This was a defect in the earlier repair, not another inherited baseline failure. Published fix **`0d3388a88aa575fba2bf9ee9c1c219053ea09418`** has the exact complete reviewed tree `be5ece2d8ff81d6112fb55c29e60beb69c8c4c09` (local `78a5ef00`).

Native legacy parsing is sign-asymmetric: `+0530` can directly follow the year, while attached minus forms can remain date syntax. The helper now recognizes attached plus after a clock and preserves the existing minus boundary, raw native validity guard, named zones, comments and unzoned UTC semantics. No parser replacement, dependency, schema or product SDK behavior changed.

The exact case is asserted as both `asOfDate` and date filter input in the selected tests that really execute under UTC, Toronto and Tokyo. Added clock-before-date attached-plus variants expand the existing native UTC reference matrix900→948; attached-minus and hyphenated-date controls remain. Independent review is scoped to these finite regressions, not exhaustive native grammar.

Before correction, the new two selected tests both failed. After: full query file27/27; independent84/84 public assertions per timezone; actual2/2 selected child tests per timezone with zero skips. Required final checks reran at this code tree: standard4391/4391, worker20/20, runtime/control types0/0. Full scrubbed failed and passing logs, exact commands/source hashes and source comparison are retained here. Existing source-time log hashes in copied sublane metadata refer to that original capture; the outer manifest binds the published path-scrubbed files.

SDK status is unchanged: the pin-specific experiment removed the effort beta only. Context-management and structured-output/tool compatibility still block actual SDK admission. No admitted SDK request or provider execution is claimed; all actual SDK captures remain at zero provider executions. Deployment and chat HOLD remain active; PR175/PR98 are untouched.
