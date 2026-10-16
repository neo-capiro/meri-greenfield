// SYNTHETIC only: real model/store/issuer code runs; canonical JSON/schema and unrelated artifact/native validator imports are mocked.
import './dependency-seams.mjs';
import {mock} from 'node:test';import {createHash} from 'node:crypto';
const root=new URL('../../../../',import.meta.url),url=p=>new URL(p,root).href;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),digest=v=>createHash('sha256').update(v).digest('hex');
mock.module(url('packages/contracts/retrieval-0.2/validate.mjs'),{namedExports:{artifactValidators:{hash}}});
mock.module(url('apps/runtime/native-authority/task-verifier.mjs'),{namedExports:{capabilityDigest:digest,matchesCapability:(v,d)=>typeof v==='string'&&digest(v)===d}});
