/** Core finite sorted-key JSON domain. Distinct ownership from Meri JCS, even when a value hashes identically. */
import {createHash} from 'node:crypto';
import {data} from '../contracts/commands-0.2/execution-boundary.mjs';
export function coreApplicationSha256(value){
 const json=v=>Array.isArray(v)?'['+v.map(json).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+json(v[k])).join(',')+'}':JSON.stringify(v);
 return createHash('sha256').update(json(data(value)),'utf8').digest('hex');
}
