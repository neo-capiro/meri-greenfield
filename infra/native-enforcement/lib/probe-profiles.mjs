// Closed immutable profile data and internal mode selection support. Pure data; no IO,
// no imports. This leaf module is deliberately dependency-free so the profiles can be
// consumed by binding/expressions/workflow/infrastructure without creating an import
// cycle. Nothing here authenticates authority, admits an image or grants execution; the
// compiled literals are binding requirements only.

const deepFreeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(deepFreeze);Object.freeze(v);}return v;};

// ---------------------------------------------------------------------------------------
// Closed mode profiles. `mode` is the only selector the internal factories branch on; the
// strings below are the exact reviewed native fragments, so the native graph/policy bytes
// are reproduced unchanged while the canary mode substitutes canary-only literals.
// ---------------------------------------------------------------------------------------
export const PROFILE_NATIVE=deepFreeze({
 mode:'native',
 probeKindTest:`($states.input.probeKind='sdk' or $states.input.probeKind='office')`,
 executionNameExpr:`('meri-native-' & $states.input.probeKind & '-' & $states.input.runUuid)`,
 probeTags:['sdk','office'],
 acceptProbeKinds:['sdk','office']
});

export const PROFILE_CANARY=deepFreeze({
 mode:'canary',
 probeKindTest:`$states.input.probeKind='canary'`,
 executionNameExpr:`('meri-canary-' & $states.input.runUuid)`,
 probeTags:['canary'],
 acceptProbeKinds:['canary']
});

// ---------------------------------------------------------------------------------------
// Canary-only compiled literals. These are fixed evidence assertions / binding literals:
// they prove nothing about live authority, freshness or image admission and are never a
// caller input. Distinct from the native two-definition contract.
// ---------------------------------------------------------------------------------------
export const CANARY_KIND='canary';
export const CANARY_FAMILY='meri-greenfield-qualification-canary';
export const CANARY_MACHINE_NAME='meri-greenfield-native-enforcement-canary-20261010';
export const CANARY_MANAGED_ROLE_NAME='MeriGreenfield-NativeEnforcement-Canary-20261010';
export const CANARY_LOG_PREFIX='qualification-canary';
export const CANARY_IMAGE='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c';
export const CANARY_IMAGE_CONFIG_SHA256='6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471';
export const CANARY_SOURCE_COMMIT='0be04d0799c9c527e300b47c19176cddb0eaa231';
export const CANARY_EXECUTABLE=deepFreeze({path:'/usr/bin/sleep',type:'file',bytes:43432,uid:0,gid:0,mode:'0755',sha256:'0637e6d47579929cb72efa46f361861b319d62c62fe8a9d10731fd7655eb5936'});
export const CANARY_EVIDENCE_PINS=deepFreeze({
 inventoryPayloadBytes:5671849,
 inventoryPayloadSha256:'a9f2ffb41e5fe251319f3e6c328529af679d83ea5e67c57097a90e685a62976f',
 resultBytes:7566681,
 resultSha256:'685a4180f8b33f35268f95ad8eed0ebd7b0eed05a47e3aeb492e67ca759d22ee',
 executable:CANARY_EXECUTABLE
});

// The exact internally set, deep-frozen four-key canary marker. Added to a canary binding's
// pins before binding-ID calculation; it is not a caller input and grants no admission.
export const CANARY_PROFILE=deepFreeze({kind:'canary',family:'meri-greenfield-qualification-canary',entryPoint:['/usr/bin/sleep'],command:['1200']});

// Immutable reviewed snapshot of the shared legacy constants the canary contract must NOT
// inherit mutably. The public TARGET/NETWORK/ROLE_PINS/LIMITS/EVIDENCE_KINDS stay writable
// for the unchanged native API; the canary factory/template/validator consume these frozen
// copies, and the canary boundaries refuse on any drift of the live exports away from this
// snapshot. This leaf stays dependency-free and acyclic.
export const CANARY_TARGET=deepFreeze({account:'967807252336',region:'us-east-1'});
export const CANARY_NETWORK=deepFreeze({vpcId:'vpc-06e1941747e798f0a',subnetId:'subnet-0864c000b771df32c',securityGroupId:'sg-0c4e15bec7adeed1a'});
export const CANARY_ROLE_PINS=deepFreeze({execution:'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationR-ExecutionRole605A040B-kL3yc2CIalc3',worker:'arn:aws:iam::967807252336:role/MeriGreenfield-Qualificatio-EmptyWorkerRole7C03C4DD-nOWJZv6LQdqD'});
export const CANARY_LIMITS=deepFreeze({D:720000,C:900000,calls:512,terminalCalls:544,pages:16,polls:120,candidates:128,owned:4,overflow:6,recordBytes:32768,ledgerBytes:16384,ctxBytes:196608,outputBytes:131072,issueBytes:1024,issues:32,errorChars:512,refChars:2048,refBytes:16384,tokenChars:2048});
export const CANARY_EVIDENCE_KINDS=deepFreeze(['source','build','image','inventory','security','taskDefinitions','iam','network','dns','logsKms']);
export const CANARY_LOG_GROUP='/meri-greenfield/qualification/runtime';
