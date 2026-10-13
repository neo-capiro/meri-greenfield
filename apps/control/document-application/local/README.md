# Executable Word drafting fixture

Run from the repository root with its existing Node dependencies and the approved local Python libraries (`python-docx 1.2.0`, Pillow). The Python executable must be an absolute path:

```sh
node scripts/local-document/run.mjs --help
node scripts/local-document/run.mjs --run --python /opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python
node --test apps/control/document-application/local/local.test.mjs
```

The command sets and restores its own source-root binding, allocates a private temporary directory and a loopback listener, obtains an opaque session through the existing issuance endpoint, and runs the real document application. It creates a DOCX brief, revises the paragraph and table, reconstructs the application graph, then inspects and downloads both exact versions. It reopens each downloaded package using python-docx and verifies the original text/table survived. Replaying the original write cannot regenerate it. Revoking the synthetic identity denies both historical downloads and a new write.

The PostgreSQL budget implementation runs against the existing scripted SQL test pool. Both versions use one bound grant and allocation and settle two synthetic 10 microUSD reservations. This is local accounting evidence; no paid model or database server is called. The existing local artifact store persists immutable objects and versions for the duration of the fixture. Reconstructing the application does not create new storage or reset the allocation.

The resulting JSON contains version/hash/lineage evidence, content inspection, accounting totals and child-process cleanup receipts. The command closes the listener and removes only its owned temporary files. A successful result requires closed process groups, no executor directories left behind, no open sockets and completed cleanup. The original 25-second fixture cutoff covers all requests. Help and malformed usage allocate no fixture, listener or subprocess.

Identity, source authorization and SQL are explicitly synthetic. The generated DOCX bytes, local immutable storage, HTTP transport and Python subprocesses are real. `nativeQualified:false`, `previewStatus:'pending'` and `generationStatus:'draft'` remain explicit. This does not qualify live Clerk, native PostgreSQL, Office rendering, visual quality, runtime sandboxing, production storage, SDK natural-language drafting or source filing. The registered production catalog remains disabled and preserves all selected capabilities; this fixture exercises only the Word drafting application increment.

`ports.mjs` and `fixture.mjs` are test-only. Product entry points must not import them. They intentionally create synthetic facts and must never be used as production authorization.
