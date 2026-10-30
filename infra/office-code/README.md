# CODE font preservation

This supplemental LibreOffice registry file preserves explicit Liberation Sans and Liberation Serif names when CODE exports Microsoft Office documents. The pinned CODE defaults map those names to Arial and Times New Roman. The overlay depends on the vendor `main` registry and clears only those two `SubstFontsMS` values. It does not rewrite document bytes, change font rendering, replace intentional Arial/Times fonts, or modify the vendor registry file.

Build the image with this directory as the context and `--platform linux/arm64`. The default base is the immutable, multi-platform CODE 26.04.5.2.1 index. Any replacement `CODE_IMAGE` must also be an explicitly reviewed digest. The Dockerfile inherits the vendor user, startup, health and security configuration. Release owns image qualification and serving configuration; this directory does not activate or deploy an editor.

Author qualification on the retained local CODE 26.04.5.2 instance loads the exact overlay through the native registry directory. Both affected XLSX/PPTX cases pass actual editing, Save, authoritative Core read, exact-byte Publish and the unchanged font/content checks. These checks use native CODE and PostgreSQL with scripted identity/artifact storage ports. They are not an authenticated deployed application or ARM64 image receipt. The full corpus result is recorded in the dated Office fidelity handback.

The separate PPTX embedded chart-workbook losses are not fixed by this overlay. Collabora issue [16243](https://github.com/CollaboraOnline/online/issues/16243) links [upstream change 13516](https://gerrit.collaboraoffice.com/c/online/+/13516), merged on 29 October 2026 at `88acbed5df032ec987390749b2845bd3ba626438`, after this CODE base was published. That change also records a remaining chart-data-update problem. Retain the chart fidelity failures until an exact candidate passes workbook relationships, untouched data and intentional data-edit/reopen checks. Do not restore old workbook parts into newly saved documents.

## Native source candidate

`Dockerfile.source` builds the complete native ARM64 engine and Online from stable `cp-26.04.5-2`, applies only the exact upstream chart patch and its two fixtures, and includes this font overlay. It adapts the [official full-source build](https://github.com/CollaboraOnline/online/tree/d309e70f6625abb03cd8476c0ea42753b35335e7/docker/from-source-gh-action) without its mutable checkout, engine-assets shortcut or Node setup script. The Ubuntu ARM64 base, signed Ubuntu snapshot and Node archive are pinned in the Dockerfile. `source/inputs.json` pins the source, patch, binary fixtures, vendor dependency lists and standard startup script. The vendor npm shrinkwrap and committed offline tarballs remain authoritative.

The build runs the upstream `CppunitTest_chart2_export` target and checks both engine/Online ELF headers for AArch64. It records input hashes, exact package lists and build/test logs in `/usr/share/meri-code-build`. These are build-time checks; they do not prove WOPI Save/Publish, browser editing, chart-data refresh, isolation or deployed acceptance. No native source build has run yet.

After Release binds and reviews the finite existing-builder request, its build command is:

```sh
docker build --platform linux/arm64 --progress=plain \
  --file infra/office-code/Dockerfile.source \
  --build-arg BUILD_JOBS=24 --tag "$REVIEWED_UNIQUE_OFFICE_TAG" infra/office-code
```

Run only on an actual ARM64 builder; emulation is not qualification. The [dated recipe handoff](../../docs/handover/20261028/OFFICE-NATIVE-SOURCE-RECIPE-20261030.txt) records the bounded capacity estimate, existing builder/operator and still-unrun checks. This source recipe neither changes the existing default overlay-only image nor submits a build, pushes an image or deploys the editor.
