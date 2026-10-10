// Browser-only trusted compiler DATA. Import has no IO or AWS side effects.
export const FIXED = Object.freeze({
  account: '967807252336', region: 'us-east-1',
  stackName: 'MeriGreenfield-BrowserQualification', logicalId: 'BrowserHost3080399B',
  vpc: 'vpc-06e1941747e798f0a', subnet: 'subnet-0864c000b771df32c',
  ami: 'ami-0fb0f484b75566814', stopAfterMs: 720000, ceilingMs: 900000,
  wireProfile: 'ec2-sdk-pascal-iso-v1', maxPages: 20, maxInstances: 20, maxRootIds: 20,
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digest = /^[0-9a-f]{64}$/;
export function validateBinding(value) {
  const fields = ['runUUID', 'stackId', 't0Ms', 'templateSha256'];
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).length !== fields.length || Object.keys(value).length !== fields.length || fields.some(k => !Object.hasOwn(value, k))) {
    throw new Error('Exact owner DATA binding required; execution/admission options forbidden');
  }
  if (fields.some(k => { const d = Object.getOwnPropertyDescriptor(value, k); return !d || !Object.hasOwn(d, 'value'); })) {
    throw new Error('Binding accessors are not DATA');
  }
  if (typeof value.runUUID !== 'string' || !uuid.test(value.runUUID) ||
      typeof value.templateSha256 !== 'string' || !digest.test(value.templateSha256) ||
      !Number.isSafeInteger(value.t0Ms) || value.t0Ms < 1700000000000 || value.t0Ms > 2000000000000) {
    throw new Error('Invalid run/time/template binding');
  }
  const prefix = `arn:aws:cloudformation:${FIXED.region}:${FIXED.account}:stack/${FIXED.stackName}/`;
  if (typeof value.stackId !== 'string' || !value.stackId.startsWith(prefix) || !uuid.test(value.stackId.slice(prefix.length))) {
    throw new Error('Exact NEW browser stack ARN required');
  }
  return Object.freeze({ ...value, D: value.t0Ms + FIXED.stopAfterMs, C: value.t0Ms + FIXED.ceilingMs });
}
export function machineName(binding) { return `MeriGreenfield-BrowserWatchdog-${binding.runUUID}`; }
