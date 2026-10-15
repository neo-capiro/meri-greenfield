import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createSignedDownloadCodec,MAX_TTL_MS} from '../signed-download.mjs';

const key=Buffer.alloc(32,7),other=Buffer.alloc(32,8),T=1_800_000_000_000;
const claims=(over={})=>({versionId:'00000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),scopeDigest:'b'.repeat(64),actorId:'actor-a',expiresAtMs:T+60000,suppressionGeneration:3,...over});
const codec=(clock={t:T},k=key)=>createSignedDownloadCodec({key:k,now:()=>clock.t});
const refused=(fn,code)=>assert.throws(fn,error=>error.code===code);

test('issue then verify returns exactly the signed claims',()=>{const c=codec();assert.deepEqual(c.verify(c.issue(claims())),claims());});
test('expiry is enforced at verification and bounded at issue',()=>{
 const clock={t:T},c=codec(clock),token=c.issue(claims());clock.t=T+59999;assert.equal(c.verify(token).actorId,'actor-a');clock.t=T+60000;refused(()=>c.verify(token),'DOWNLOAD_LINK_EXPIRED');
 refused(()=>codec().issue(claims({expiresAtMs:T})),'DOWNLOAD_LINK_CLAIMS');refused(()=>codec().issue(claims({expiresAtMs:T+MAX_TTL_MS+1})),'DOWNLOAD_LINK_CLAIMS');
});
test('any change to claims or signature, a foreign key, or a spliced token is DOWNLOAD_LINK_INVALID',()=>{
 const c=codec(),token=c.issue(claims()),[payload,signature]=token.split('.');
 const altered=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url')),actorId:'actor-b'})).toString('base64url');
 const spliced=c.issue(claims({versionId:'00000000-0000-4000-8000-000000000002'})).split('.')[0];
 const flip=s=>s.slice(0,-1)+(s.at(-1)==='A'?'B':'A');
 for(const t of [`${altered}.${signature}`,`${spliced}.${signature}`,`${payload}.${flip(signature)}`,`${flip(payload)}.${signature}`,codec({t:T},other).issue(claims()),'',`${payload}`,`${payload}.${signature}.x`,token+'=',null])refused(()=>c.verify(t),'DOWNLOAD_LINK_INVALID');
});
test('validly signed but malformed claims are refused, and weak keys or missing clocks are configuration errors',()=>{
 // The wire format is pinned: HMAC-SHA256 over the fixed domain and the exact base64url claim bytes.
 const sign=value=>{const payload=Buffer.from(JSON.stringify(value)).toString('base64url');return `${payload}.${createHmac('sha256',key).update('meri.artifact-download.v1.'+payload).digest('base64url')}`;};
 const c=codec();assert.equal(c.verify(sign(claims())).versionId,claims().versionId);
 for(const value of [{...claims(),extra:1},claims({expiresAtMs:'1'}),claims({actorId:''}),[claims()],'claims'])refused(()=>c.verify(sign(value)),'DOWNLOAD_LINK_INVALID');
 refused(()=>c.issue(claims({sha256:'A'.repeat(64)})),'DOWNLOAD_LINK_CLAIMS');refused(()=>c.issue({...claims(),extra:1}),'DOWNLOAD_LINK_CLAIMS');refused(()=>c.issue(claims({suppressionGeneration:-1})),'DOWNLOAD_LINK_CLAIMS');
 refused(()=>createSignedDownloadCodec({key:Buffer.alloc(31),now:Date.now}),'DOWNLOAD_LINK_CONFIGURATION');refused(()=>createSignedDownloadCodec({key:'x'.repeat(64),now:Date.now}),'DOWNLOAD_LINK_CONFIGURATION');refused(()=>createSignedDownloadCodec({key}),'DOWNLOAD_LINK_CONFIGURATION');
});
