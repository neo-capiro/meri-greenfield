/** Test helper: drops the per-throw detail (cause, message hash, code site) from a RUNNER_FIRST_FAILURE line so suites can
 * assert its fixed classification exactly; runner-runtime-diagnostics.test.mjs asserts the detail fields themselves. */
export const withoutDetail = line => line.replace(/ cause=\S+ msg=\S+ site=\S+(?=\n$)/u, '');
