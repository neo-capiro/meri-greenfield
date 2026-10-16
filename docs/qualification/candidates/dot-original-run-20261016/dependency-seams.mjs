// Synthetic imports only; real new helper, canonical issuer and memory journal execute. Public schemas/canonicalize/native compiler UNRUN.
import {mock} from 'node:test';import {createHash} from 'node:crypto';
const root=new URL('../../../../',import.meta.url),url=p=>new URL(p,root).href,sha=v=>createHash('sha256').update(v).digest('hex');
mock.module(url('packages/contracts/validate.mjs'),{namedExports:{canonicalSha256:v=>sha(JSON.stringify(v)),validateShape:(_name,v)=>v}});
mock.module(url('apps/artifacts/storage/boundary.mjs'),{namedExports:{storageMethod:(owner,key)=>{if(typeof owner?.[key]!=='function')throw Error('SYNTHETIC_PORT_MISSING');return owner[key].bind(owner);}}});
mock.module(url('apps/runtime/native-authority/task-verifier.mjs'),{namedExports:{capabilityDigest:sha,matchesCapability:(raw,digest)=>sha(raw)===digest}});
