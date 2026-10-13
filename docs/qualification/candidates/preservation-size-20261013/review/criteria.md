# Preservation size review criteria

Baseline a16e52ef5bd8d570c995dff298facbc0d1969000. Review only new independent schema-size test and this packet/report. Freeze before candidate inspection. No real database/native evidence or external services.

Accept only an explicit bounded preservation-specific serialized UTF-8 limit, preserving the ordinary 1 MiB default, existing row-count/data inertness limits, and complete metadata comparison. Test below/at/above both limits, multibyte text, a synthetic full 3,128,280-byte inventory, mutations near its tail, prepare/reconstruction equality, oversized snapshots before DDL and after possible effects, and hostile structures without invoking getters. Preserve all baseline failures and original tests. Audit exact original production changes and migration/native fixture bytes. Run bounded subprocesses, retain raw output and verify owned groups absent; no broad unrelated suite.
