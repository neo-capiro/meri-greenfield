# Original evidence bytes

Repository attributes specify `text=auto eol=lf`. Git normalized the Windows JSON metadata/manifests when adding evidence commit01d023cc; original stdout/stderr remain unchanged. The metadata SHA values recorded by HANDOFF and SOURCE-FILES refer to original bytes, which must not be guessed from normalized Git JSON.

`RAW-CONTROLS.zip` preserves all29 original JSON/stdout/stderr files byte for byte, including HANDOFF and SOURCE-FILES. Every archive entry was reopened and SHA256-checked against its source bytes. `RAW-CONTROLS-INDEX.json` records original sizes/SHA256 and normalized committed Git blob IDs. Its archive SHA is the portable binary pickup pin. The first evidence commit and all earlier raw outcomes are preserved; no manifest was silently repinned. This archive correction changes no source/test bytes and requires no test rerun.

The two whitespace warnings from `git diff --check` are blank lines in the original failed custody-private-schema-seam stdout stack trace. They are preserved as evidence, not source formatting changes. Source commit99ed57c6 passed its own diff check.
