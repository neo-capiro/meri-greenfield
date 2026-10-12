// Single immutable metadata projection. No SQL, query engine, grants or source access.
import data from './public-domain-datasets.json' with {type:'json'};
import {snapshotOperationData} from './operation-contracts.mjs';
const EXPECTED = 'f9b4dd84165011700f47f4a3f454226b80b4199bdb35436f72c30f7c2d2ff2b4';
const fail = message => { throw new Error(message); };
const admitted = new WeakSet();
export function assertPublicDomainDatasetRegistry(value) {
  if (!admitted.has(value)) fail('Canonical dataset metadata provider required');
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
export function createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata}) {
  if (typeof canonicalSha256 !== 'function' || typeof validateMetadata !== 'function') fail('Dataset registry dependencies');
  const projected = snapshotOperationData(data);
  if (canonicalSha256(projected) !== EXPECTED) fail('Pinned dataset projection changed');
  const snapshots = new Map();
  for (const entry of projected.datasets) {
    validateMetadata('DatasetMetadataSummary',entry.metadata);
    if (snapshots.has(entry.metadata.key) || !Number.isSafeInteger(entry.defaultLimit) ||
        !Number.isSafeInteger(entry.maxLimit) || entry.defaultLimit < 1 || entry.maxLimit < entry.defaultLimit)
      fail('Invalid dataset identity or row limits');
    const fields = entry.metadata.fields;
    if (new Set(fields.map(field=>field.name)).size !== fields.length ||
        fields.some(field=>field.aggregatable !== (field.type === 'number'))) fail('Invalid dataset metadata fields');
    const body = {metadata:entry.metadata,defaultLimit:entry.defaultLimit,maxLimit:entry.maxLimit};
    snapshots.set(entry.metadata.key,freeze({...body,snapshotSha256:canonicalSha256(body)}));
  }
  const metadata = freeze(projected.datasets.map(entry=>entry.metadata));
  const provider = Object.freeze({source:freeze(projected.source),projectionSha256:EXPECTED,
    listDatasetMetadata:()=>metadata,
    resolveDatasetSnapshot(key) { if (typeof key !== 'string' || !snapshots.has(key)) fail('Unknown global dataset'); return snapshots.get(key); },
  });
  admitted.add(provider); return provider;
}
