/** A signed link acts like a temporary password until it expires. This test drives issue and redeem, and every refusal path that
 * carries a token, through the real runtime HTTP listener with the control telemetry instrumentation over in-memory OpenTelemetry
 * providers, and proves no token (or its claims or signature part) reaches process output, spans, span events, span status, metric
 * attributes or any refusal body. The key is read from an owner-only file through the gate's readSecret path. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listenRuntime} from '../../http-server.mjs';
import {instrumentApplication} from '../../telemetry/http.mjs';
import {inMemoryInstruments} from '../../telemetry/test/fixture.mjs';
import {createDownloadLinkGate} from '../index.mjs';
import {T,key,versionId,harness} from './link-fixture.mjs';

function captureOutput(){
 const seen=[],originals={stdout:process.stdout.write,stderr:process.stderr.write},consoles={};
 const tap=stream=>function(chunk,...rest){seen.push(typeof chunk==='string'?chunk:Buffer.from(chunk).toString('utf8'));return originals[stream].call(this,chunk,...rest);};
 process.stdout.write=tap('stdout');process.stderr.write=tap('stderr');
 for(const name of ['log','info','warn','error','debug','trace']){consoles[name]=console[name];console[name]=(...args)=>{seen.push(args.map(a=>a instanceof Error?`${a.name}: ${a.message} ${a.stack}`:typeof a==='string'?a:JSON.stringify(a)).join(' '));};}
 return {text:()=>seen.join('\n'),restore(){process.stdout.write=originals.stdout;process.stderr.write=originals.stderr;Object.assign(console,consoles);}};
}

test('no signed link reaches process output, telemetry spans, span events, metric attributes or refusal bodies',{timeout:30000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'meri-link-redaction-')),keyFile=join(directory,'download-link.key');
 const output=captureOutput(),telemetry=inMemoryInstruments();let listener;
 try{
  await writeFile(keyFile,key,{mode:0o600});
  const h=harness(),gate=createDownloadLinkGate({documents:h.documents,sessions:h.sessions,now:()=>h.clock.t,maxRequestMs:3000,links:{enabled:true,keyFile},suppression:{journal:h.journal,serving:h.serving},authorization:{async resolve(){return null;}},store:{async verifyPrivate(){return {};}}});
  assert.deepEqual(await gate.open(),{enabled:true,reason:'ENABLED'});
  const application=instrumentApplication(telemetry.instruments,gate,{now:()=>h.clock.t});
  listener=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://frontend.synthetic.invalid'},limits:{requestMs:3000,shutdownMs:1000}},application,readiness:async()=>{}});
  const base=`http://127.0.0.1:${listener.address.port}`,headers=(credential='action_session_a')=>({authorization:'Bearer '+credential,'content-type':'application/json'});
  const post=(path,body,credential)=>fetch(base+path,{method:'POST',headers:headers(credential),body:typeof body==='string'?body:JSON.stringify(body)});
  const issued=await post('/api/documents/links/issue',{versionId});assert.equal(issued.status,200);const {token}=await issued.json();
  const [payload,signature]=token.split('.'),secrets=[token,payload,signature,payload.slice(0,40)];
  const redeemed=await post('/api/documents/links/redeem',{token});assert.equal(redeemed.status,200);assert.deepEqual(Buffer.from(await redeemed.arrayBuffer()),h.bytes);
  const bodies=[];const refused=async(response,status)=>{assert.equal(response.status,status);bodies.push(await response.text());};
  await refused(await post('/api/documents/links/redeem',{token},'action_session_b'),403);
  await refused(await post('/api/documents/links/redeem',{token:`${payload}.${'A'.repeat(43)}`}),403);
  await refused(await post('/api/documents/links/redeem',`{"token":"${token}"`),400);
  await refused(await post('/api/documents/links/redeem?token='+token,{token}),400);
  await refused(await post('/api/documents/links/redeem/'+token,{}),404);
  await refused(await post('/api/documents/links/redeem',{token,extra:token}),400);
  h.journal.rows.set(`tenant-a:conversation:${'00000000-0000-4000-8000-0000000000c1'}`,{state:'RELEASED',ledgerSequence:3});
  await refused(await post('/api/documents/links/redeem',{token}),410);
  h.clock.t=T+60000;await refused(await post('/api/documents/links/redeem',{token}),410);
  await listener.close();listener=undefined;

  const spans=telemetry.spans(),points=await telemetry.points('meri.http.server.duration');
  assert.equal(spans.length,10);assert.equal(points.reduce((n,p)=>n+p.value.count,0),10);
  const paths=spans.map(s=>s.attributes['url.path']);
  assert.equal(paths.filter(p=>p==='/api/documents/links/redeem').length,8);assert.ok(paths.includes('/api/documents/links/redeem/{redacted}'));
  const recorded=JSON.stringify({spans:spans.map(s=>({name:s.name,attributes:s.attributes,events:s.events.map(e=>({name:e.name,attributes:e.attributes})),status:s.status,links:s.links})),points:points.map(p=>p.attributes)});
  for(const [label,text] of [['telemetry',recorded],['process output',output.text()],['refusal bodies',bodies.join('\n')]])
   for(const secret of secrets)assert.equal(text.includes(secret),false,`${label} must not contain any part of a signed link`);
  for(const body of bodies)assert.match(body,/^\{"error":\{"code":"[A-Z_]+"(,"outcome":"[A-Z_]+")?\}\}$/u);
 }finally{output.restore();await listener?.close();await telemetry.close();await rm(directory,{recursive:true,force:true});}
});
