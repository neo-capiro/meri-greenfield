import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {syntheticTenants,tenantPairs} from '../tenants.mjs';
import {generateCases} from '../generate.mjs';
import {classify,detectLeak,victimMarkers,CATEGORIES,SURFACES} from '../oracle.mjs';
import {executeCase} from '../execute.mjs';
import {runIsolationHarness,buildReport,main,MINIMUM_CASES} from '../run.mjs';
const tenants=syntheticTenants();
const streams=()=>{const out=[],err=[];return {out,err,stdout:{write:s=>out.push(s)},stderr:{write:s=>err.push(s)}};};
test('case generation is deterministic, pairwise, unique and covers every category and surface',()=>{
 const a=generateCases(tenants),b=generateCases(tenants);assert.deepEqual(a,b);assert.ok(a.length>=MINIMUM_CASES);
 assert.equal(new Set(a.map(c=>c.caseId)).size,a.length);assert.equal(tenantPairs(tenants).length,6);
 for(const c of a){assert.notEqual(c.attacker,c.victim);assert.ok(CATEGORIES.includes(c.category));assert.ok(SURFACES.includes(c.surface));assert.equal(c.expectation,'refused');}
 for(const category of CATEGORIES)assert.ok(a.some(c=>c.category===category),category);for(const surface of SURFACES)assert.ok(a.some(c=>c.surface===surface),surface);
});
test('the oracle flags victim markers, unexpected acceptance and unrecognized failures',()=>{
 const victim=tenants[1],markers=victimMarkers(victim,{sessionCredential:'action_session_'+'k'.repeat(43),artifactVersionId:'00000099-be7a-4000-8000-000000000000'});
 assert.ok(markers.includes(victim.promptSentinel)&&markers.includes(victim.principal.binding.conversationId)&&markers.includes('00000099-be7a-4000-8000-000000000000'));
 assert.deepEqual(detectLeak(`403 {"error":{"code":"SESSION_REFUSED"}}`,markers),[]);
 assert.equal(classify({accepted:false,refusal:true,text:`events ${victim.promptSentinel}`},markers).outcome,'leaked');
 assert.equal(classify({accepted:true,refusal:false,text:'200 {"ok":true}'},markers).outcome,'unexpected-success');
 assert.equal(classify({accepted:false,refusal:false,text:'TypeError: g is not defined'},markers).outcome,'harness-error');
 assert.equal(classify({accepted:false,refusal:true,text:'ACCESS_DENIED'},markers).outcome,'refused');
 assert.throws(()=>detectLeak(undefined,markers),/ORACLE_TEXT/);
});
test('a leaking artifact surface is detected by the executor and oracle, not assumed refused',async()=>{
 const [attacker,victim]=tenants,c=generateCases(tenants).find(x=>x.surface==='artifact-service'&&x.attacker===attacker.tenantId&&x.victim===victim.tenantId&&x.attack.operation==='download');
 const seeded=new Map([[victim.tenantId,{artifactVersionId:'00000099-be7a-4000-8000-000000000000'}]]);
 const leaky={seeded,artifacts:{context:p=>({binding:p.binding}),service:{async download(){return {bytes:Buffer.from(`leaked ${victim.artifactSentinel}`)};}}}};
 const observation=await executeCase(leaky,tenants,c);assert.equal(observation.accepted,true);
 assert.equal(classify(observation,victimMarkers(victim,seeded.get(victim.tenantId))).outcome,'leaked');
});
test('report assembly fails closed on any leak, acceptance, harness fault, failed control or short cohort',()=>{
 const rows=generateCases(tenants).map(c=>({caseId:c.caseId,category:c.category,surface:c.surface,attacker:c.attacker,victim:c.victim,outcome:'refused'})),controls=[{controlId:'own-history:tenant-alpha',ok:true}],generatedAt='2026-10-15T00:00:00.000Z';
 assert.equal(buildReport({tenants,rows,controls,generatedAt}).pass,true);
 for(const [outcome,reason] of [['leaked','CROSS_TENANT_DISCLOSURE'],['unexpected-success','UNEXPECTED_ACCEPTANCE'],['harness-error','HARNESS_ERROR']]){const r=buildReport({tenants,rows:[{...rows[0],outcome},...rows.slice(1)],controls,generatedAt});assert.equal(r.pass,false);assert.ok(r.reasons.includes(reason));}
 assert.ok(buildReport({tenants,rows,controls:[{controlId:'x',ok:false}],generatedAt}).reasons.includes('ORACLE_CONTROL_FAILED'));
 assert.ok(buildReport({tenants,rows:rows.slice(0,MINIMUM_CASES-1),controls,generatedAt}).reasons.includes('TOO_FEW_CASES'));
 assert.ok(buildReport({tenants:tenants.slice(0,2),rows,controls,generatedAt}).reasons.includes('TOO_FEW_TENANTS'));
 assert.ok(buildReport({tenants,rows:rows.filter(r=>r.category!=='session-key'),controls,generatedAt}).reasons.includes('MISSING_CATEGORY_SESSION_KEY'));
});
test('the whole harness refuses every generated cross-tenant case across three synthetic tenants',async()=>{
 const report=await runIsolationHarness();
 assert.equal(report.label,'LOCAL_FIXTURE');assert.equal(report.pass,true,JSON.stringify(report.reasons));assert.deepEqual(report.reasons,[]);
 assert.ok(report.caseCount>=MINIMUM_CASES);assert.equal(report.tenants.length,3);assert.equal(report.outcomes.refused,report.caseCount);
 assert.equal(report.outcomes.leaked,0);assert.equal(report.outcomes['unexpected-success'],0);assert.equal(report.outcomes['harness-error'],0);
 assert.equal(report.controls.length,12);assert.ok(report.controls.every(c=>c.ok));
 for(const category of CATEGORIES)assert.ok(report.categories[category]>0);for(const surface of SURFACES)assert.ok(report.surfaces[surface]>0);
 assert.equal(report.qualification.state,'UNQUALIFIED');assert.ok(report.rows.every(r=>r.leakedMarkers===0));
});
test('CLI writes an exclusive report, refuses an existing output and reports a failing run with exit 1',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'meri-isolation-'));try{
  const s=streams();assert.equal(await main(['--help'],s),0);assert.match(s.out.join(''),/Exit 0/);
  assert.equal(await main(['--bogus'],streams()),2);
  const ok=streams(),output=join(dir,'report.json');assert.equal(await main(['--output',output],ok),0);const written=JSON.parse(await readFile(output,'utf8'));assert.equal(written.pass,true);assert.match(ok.out.join(''),/"pass":true/);
  assert.equal(await main(['--output',output],streams()),2);
  const failing=streams();assert.equal(await main(['--output',join(dir,'failing.json')],{...failing,run:async()=>buildReport({tenants,rows:[],controls:[],generatedAt:'2026-10-15T00:00:00.000Z'})}),1);assert.match(failing.out.join(''),/TOO_FEW_CASES/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
