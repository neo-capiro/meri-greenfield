// Synthetic dependency seam only: real canonicalize/Ajv are unavailable and UNRUN.
// Only hash is replaced. Plain JSON fixtures use ASCII keys; no production canonicalization claim.
import {mock} from 'node:test';import {createHash} from 'node:crypto';
mock.module(new URL('../../../../packages/contracts/validate.mjs',import.meta.url).href,{namedExports:{canonicalSha256:v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')}});
