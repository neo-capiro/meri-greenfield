// W02-21 configuration/binding validation: pinned identities, immutable
// tables and run/digest validators. Frozen declaration text only; no IO,
// synthesis or process action occurs at import.

export const TARGET = Object.freeze({ account: '967807252336', region: 'us-east-1', az: 'us-east-1a' });
export const QUALIFICATION_NETWORK = Object.freeze({
  vpcId: 'vpc-06e1941747e798f0a',
  subnetId: 'subnet-0864c000b771df32c',
  endpointSecurityGroupId: 'sg-030c8a7ce5adea043',
  s3PrefixListId: 'pl-63a5400a',
});
export const PINS = Object.freeze({
  // W02-16: refreshed to the statically accepted worker image
  // (W02-08-BUILD-3-STATIC-ACCEPTANCE.md). The previous digest
  // sha256:7327f045... is retained only as historical provenance and is no
  // longer an allowed candidate. All three identities below are required and
  // are pinned literals, never caller-supplied.
  image: '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c',
  imageRepository: 'meri-greenfield/qualification-worker',
  imageConfigId: 'sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471',
  imageRevision: '0be04d0799c9c527e300b47c19176cddb0eaa231',
  imageKind: 'worker-inventory-only',
  ami: 'ami-0fb0f484b75566814',
  amiOwner: '591542846629',
  amiArch: 'x86_64',
  ssmRecommendedVersion: 153,
  ecsAl2023Version: '2023.0.20261001',
  kernel: '6.1',
  docker: '25.0.16',
  ecsAgent: '1.107.0',
  ecsRecipeCommit: 'ef941b7278cfd81d9c4bb76d2add25f2480060e3',
  ecsRecipeDerivedMinimal: '2023.12.20260930.0',
  instanceType: 't3.large',
  rootVolumeGiB: 30,
  seccompMobyCommit: '6fdf0a663f15d71b6944cb0b2bc3abac221ff15c',
  seccompDefaultBytes: 12828,
  seccompDefaultSha256: '9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76',
  seccompDerivedBytes: 17188,
  seccompDerivedSha256: 'e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6',
  seccompPreservedRules: 31,
  seccompAppendedRules: 5,
  chromiumCommit: '384c82079f60e0b79cdca6e49efd5cfceefa5b74',
  chromiumVersion: '155.0.8059.12',
  browserDeadlineSeconds: 120,
  guestLifetimeMinutes: 15,
  userDataLimitBytes: 16384,
  logGroupName: '/meri-greenfield/qualification/browser-host',
  runIdPattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
});
export const BROWSER_ROOT = '/opt/meri-browsers';
export const BROWSER_EXE_PATTERN_SOURCE = '^/opt/meri-browsers/chromium-[0-9]+/chrome-linux/chrome$';
export const PINNED_IMAGE = PINS.image;
export const HOST_EVIDENCE_RULES = Object.freeze({
  browserBinaryRoot: BROWSER_ROOT,
  requireHostCapabilitiesZero: true,
  requireNoNewPrivs: 1,
  requireSeccompMode: 2,
  requireRendererFiltersBeyondBaseline: true,
});
export function validateRunUUID(runUUID) {
  if (typeof runUUID !== 'string' || runUUID.length !== 36 || !new RegExp(PINS.runIdPattern).test(runUUID)) {
    throw new Error('An explicit canonical lowercase UUID is required (--run-uuid UUID)');
  }
  return runUUID;
}
export function validateAssetsImage(assetsImage) {
  const repository = `${TARGET.account}.dkr.ecr.${TARGET.region}.amazonaws.com/${PINS.imageRepository}@sha256:`;
  if (typeof assetsImage !== 'string' || assetsImage.length !== repository.length + 64 ||
      !assetsImage.startsWith(repository) || !/^[0-9a-f]{64}$/.test(assetsImage.slice(repository.length))) {
    throw new Error('An explicit same-qualification-repository immutable digest is required (--assets-image REPO@sha256:HEX64)');
  }
  if (assetsImage === PINS.image) throw new Error('Support assets must use their own reviewed digest, distinct from the worker image');
  return assetsImage;
}
