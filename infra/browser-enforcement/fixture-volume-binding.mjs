// Qualification-only fixed ownership DATA. No IO, environment or clients.
export const FIXTURE = Object.freeze({
  account: '967807252336', region: 'us-east-1',
  runUuid: 'b247b9a1-bfde-414a-a76b-9ff4fdd83110',
  subnet: 'subnet-0864c000b771df32c', vpc: 'vpc-06e1941747e798f0a', az: 'us-east-1a',
  keyArn: 'arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042',
  ceilingMs: 900000, createWindowMs: 300000, maxPages: 8, pageSize: 100,
  maxRows: 800, maxCalls: 512, maxPolls: 160, maxResultChars: 32768, maxTokenChars: 2048,
  wireProfile: 'UNQUALIFIED-ec2-sdk-pascal-iso-millis-z-v1',
});
export const fixtureTags = () => [
  { Key: 'MeriComponent', Value: 'qualification-browser-wire' },
  { Key: 'QualificationRun', Value: FIXTURE.runUuid },
  { Key: 'MeriPurpose', Value: 'empty-absence-wire' },
];
export function validateFixtureBinding(input) {
  const keys = ['t0Ms', 'createNotAfterMs', 'ownerBindingId'];
  if (!input || Object.getPrototypeOf(input) !== Object.prototype || Reflect.ownKeys(input).length !== keys.length ||
      keys.some(k => !Object.hasOwn(input, k) || !Object.hasOwn(Object.getOwnPropertyDescriptor(input, k), 'value'))) {
    throw new Error('Exact trusted owner DATA binding required; no admission flags/accessors');
  }
  if (!Number.isSafeInteger(input.t0Ms) || input.t0Ms < 1700000000000 || input.t0Ms > 2000000000000 ||
      !Number.isSafeInteger(input.createNotAfterMs) || input.createNotAfterMs <= input.t0Ms ||
      input.createNotAfterMs > input.t0Ms + FIXTURE.createWindowMs ||
      typeof input.ownerBindingId !== 'string' || !/^[0-9a-f]{64}$/.test(input.ownerBindingId)) {
    throw new Error('Invalid fixed original window/binding; owner IDs are external pins, not authority');
  }
  return Object.freeze({ ...input, C: input.t0Ms + FIXTURE.ceilingMs });
}
export const fixtureMachineName = () => `MeriGF-BrowserFixture-${FIXTURE.runUuid}`;
export const fixtureExecutionName = () => `meri-browser-fixture-${FIXTURE.runUuid}`;
