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

## Deployed runtime configuration

The preview editor runs as ECS service `capiro-preview-office` (cluster `capiro-dev`) with an entrypoint that writes the Meri control CA (`OFFICE_CONTROL_CA_PEM`, a public certificate) to `/tmp/control-ca.pem` and then sets `extra_params` for the vendor startup script:

```text
--o:ssl.enable=false --o:ssl.termination=true
--o:server_name=office-preview.app-dev.capiro.ai:443
--o:storage.ssl.ca_file_path=/tmp/control-ca.pem
--o:net.frame_ancestors=https://app.capiro.ai
--o:storage.wopi.host[0]=control[.]meri-preview[.]internal --o:storage.wopi.host[0][@allow]=true
--o:admin_console.enable=false --o:security.capabilities=false --o:mount_jail_tree=false
--o:security.enable_macros_execution=false --o:security.macro_security_level=3
--o:logging.level=warning
```

The CA path must be `storage.ssl.ca_file_path`. With `ssl.enable=false` and `ssl.termination=true`, CODE ignores `ssl.ca_file_path`, so its WOPI calls to Meri control fail with "self-signed certificate in certificate chain" and "No answer to CheckFileInfo". Keep certificate verification on; do not set `ssl_verification` to false. Task definition revision 3 carries this value; revision 2 had `ssl.ca_file_path`.
