# Complete inventory dimension supplement

Source remains `2444edc0d6bcfb5771bf26eda9e1c8eb06525783`; original packet `b5ee4a4c` is immutable. New supplemental test `9e323dc1cfd061ff9da9ae2d234b70a6f4d3df7e` adds one independent-of-native-data synthetic inventory. The dimensions are parent-supplied, not copied private records.

The test asserts one row, all twelve nonempty metadata arrays,8,362 records,3,128,280 UTF-8 serialized row bytes and1,110,747 serialized column-array bytes. All8,362 synthetic records have nonempty distributed text; no one giant padding record stands in for inventory cardinality. The full rows tree has exactly100,000 nodes, the unchanged shared admission ceiling. Complete metadata survives install/reconstruction, the existing fingerprints agree, and source input bytes remain exact. A same-byte-length final label-record tail mutation refuses reconstruction. Adding one node to reach100,001 refuses before any DDL despite remaining below4MiB. Original transaction outcomes and source bounds remain unchanged.

The bounded check passed1/1 in1.17 seconds, no timeout/kill. Owned group531533 is freshly absent. No dependencies, native metadata, database connections or other runtime actions were used. Source equality was checked against exact2444 for all three schema modules. The original author/independent tests are unchanged and were not needlessly rerun.
