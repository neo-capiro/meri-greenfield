#!/usr/bin/env node
/** Adversarial tenant-isolation harness over offline targets. Fails closed: one leaked or unexpectedly accepted case fails the run. */
import {open,realpath} from 'node:fs/promises';import {constants} from 'node:fs';import {resolve,dirname} from 'node:path';import {pathToFileURL} from 'node:url';
import {syntheticTenants} from './tenants.mjs';
import {generateCases} from './generate.mjs';
import {createIsolationTargets} from './targets.mjs';
import {executeCase,executeControls} from './execute.mjs';
import {classify,victimMarkers,CATEGORIES,SURFACES,OUTCOMES} from './oracle.mjs';
export const MINIMUM_CASES=100,MINIMUM_TENANTS=3;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const count=(rows,key,values)=>Object.fromEntries(values.map(v=>[v,rows.filter(r=>r[key]===v).length]));
/** Pure report assembly so a test can prove that a leaked row or failed control fails the run. */
export function buildReport({tenants,rows,controls,generatedAt}){
 const outcomes=count(rows,'outcome',OUTCOMES),controlsFailed=controls.filter(c=>!c.ok).length;
 const reasons=[];if(tenants.length<MINIMUM_TENANTS)reasons.push('TOO_FEW_TENANTS');if(rows.length<MINIMUM_CASES)reasons.push('TOO_FEW_CASES');if(outcomes.leaked)reasons.push('CROSS_TENANT_DISCLOSURE');if(outcomes['unexpected-success'])reasons.push('UNEXPECTED_ACCEPTANCE');if(outcomes['harness-error'])reasons.push('HARNESS_ERROR');if(controlsFailed)reasons.push('ORACLE_CONTROL_FAILED');
 for(const category of CATEGORIES)if(!rows.some(r=>r.category===category))reasons.push(`MISSING_CATEGORY_${category.toUpperCase().replace('-','_')}`);
 return {schema:'meri-isolation-report/1',label:'LOCAL_FIXTURE',generatedAt,tenants:tenants.map(t=>t.tenantId),caseCount:rows.length,minimumCases:MINIMUM_CASES,
  categories:count(rows,'category',CATEGORIES),surfaces:count(rows,'surface',SURFACES),outcomes,controls,pass:reasons.length===0,reasons,rows,
  qualification:{state:'UNQUALIFIED',note:'Offline composed-owner evidence only. Not live policy, membership, deployment, browser-state or file isolation acceptance.'}};
}
export async function runIsolationHarness({now=Date.now,tenants=syntheticTenants()}={}){
 const cases=generateCases(tenants),targets=await createIsolationTargets({tenants,now});
 try{const controls=await executeControls(targets,tenants),rows=[];
  for(const c of cases){const victim=tenants.find(t=>t.tenantId===c.victim),markers=victimMarkers(victim,targets.seeded.get(victim.tenantId));
   const observation=await executeCase(targets,tenants,c),verdict=classify(observation,markers);
   rows.push({caseId:c.caseId,category:c.category,surface:c.surface,attacker:c.attacker,victim:c.victim,note:c.note,outcome:verdict.outcome,observed:String(observation.status).slice(0,80),leakedMarkers:verdict.leaked.length});}
  return buildReport({tenants,rows,controls,generatedAt:new Date(now()).toISOString()});
 }finally{targets.close();}
}
const HELP=`Usage: node evals/isolation/run.mjs --output NEWFILE
Runs ${MINIMUM_CASES}+ generated cross-tenant cases across ${MINIMUM_TENANTS} synthetic tenants against offline targets and writes a JSON report (new file, mode 0600).
Exit 0: every case refused and every control passed; exit 1: any leak, unexpected acceptance, failed control or short cohort; exit 2: invalid arguments or I/O.
LOCAL_FIXTURE only: no live service, database, browser, model or network is used, and no deployment isolation is proven.\n`;
async function write(path,value){const absolute=resolve(path),parent=dirname(absolute);if(await realpath(parent)!==parent)fail('ISOLATION_PATH_SYMLINK');
 const handle=await open(absolute,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await handle.close();}}
export async function main(args,{stdout=process.stdout,stderr=process.stderr,run=runIsolationHarness}={}){
 if(args.length===1&&['--help','-h'].includes(args[0])){stdout.write(HELP);return 0;}
 if(args.length!==2||args[0]!=='--output'||typeof args[1]!=='string'||!args[1]){stderr.write(JSON.stringify({error:'ISOLATION_CLI_ARGUMENTS'})+'\n');return 2;}
 try{const report=await run();await write(args[1],report);stdout.write(JSON.stringify({schema:report.schema,label:report.label,caseCount:report.caseCount,outcomes:report.outcomes,pass:report.pass,reasons:report.reasons})+'\n');return report.pass?0:1;}
 catch(error){stderr.write(JSON.stringify({error:typeof error?.code==='string'?error.code:'ISOLATION_RUN_ERROR'})+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main(process.argv.slice(2));
