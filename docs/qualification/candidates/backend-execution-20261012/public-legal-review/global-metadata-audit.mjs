// Syntax-only private-source metadata check. No import/evaluation of that source.
import ts from '/workspace/meri-read-continuation-20261012/packages/contracts/node_modules/typescript/lib/typescript.js';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
const frozen='fd8765ec01d292013758606204f2c9d886cd31c1',current=execFileSync('git',['-C','/workspace/capirov2','rev-parse','4be13b0b']).toString().trim();
const candidate='0463c80a521c0d0db83f3769b1511e54a4d8b3f5',base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';
const checks=[],references=[];const check=(name,ok)=>checks.push({name,pass:!!ok});
const privateFile=(ref,p)=>execFileSync('git',['-C','/workspace/capirov2','show',`${ref}:${p}`]);
const refs=['apps/api/src/meri/analytics/global-dataset-registry.ts','apps/api/src/meri/analytics/query-spec-compiler.ts','apps/api/src/meri/analytics/analytics-db.service.ts','apps/api/src/meri/meri-tools.service.ts'];
for(const path of refs){const versions=[frozen,current].map(commit=>{const b=privateFile(commit,path);return{commit,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),blob:execFileSync('git',['-C','/workspace/capirov2','rev-parse',`${commit}:${path}`]).toString().trim()};});references.push({path,versions});check(`frozen/current same ${path}`,versions[0].sha256===versions[1].sha256);}
const bytes=privateFile(frozen,refs[0]),ast=ts.createSourceFile(refs[0],bytes.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const declarations=[];function walk(node){if(ts.isVariableDeclaration(node))declarations.push(node);ts.forEachChild(node,walk);}walk(ast);
const find=name=>{const found=declarations.filter(n=>ts.isIdentifier(n.name)&&n.name.text===name);if(found.length!==1)throw Error('Ambiguous declaration');return found[0].initializer;};
function props(node){if(!ts.isObjectLiteralExpression(node))throw Error('Expected static object');return node.properties.map(p=>{if(!ts.isPropertyAssignment(p)||!(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)))throw Error('Unsupported member');return[p.name.text,p.initializer];});}
function val(node){if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;if(ts.isNumericLiteral(node))return Number(node.text);if(node.kind===ts.SyntaxKind.TrueKeyword)return true;if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isTemplateExpression(node))return node.head.text+node.templateSpans.map(s=>{if(!ts.isIdentifier(s.expression))throw Error('Nonconstant metadata interpolation');return val(find(s.expression.text))+s.literal.text;}).join('');throw Error('Unsupported metadata literal');}
const data=JSON.parse(readFileSync('packages/contracts/retrieval-0.2/public-domain-datasets.json'));
const expected=[];
for(const [key,node]of props(find('GLOBAL_DATASET_REGISTRY'))){const d=new Map(props(node)),fields=[];for(const[name,node]of props(d.get('fields'))){const f=new Map(props(node));const type=val(f.get('type'));fields.push({name,type,description:val(f.get('description')),filterable:f.has('filterable')?val(f.get('filterable')):true,groupable:f.has('groupable')?val(f.get('groupable')):true,aggregatable:type==='number'});}
 const row={metadata:{key:val(d.get('key')),description:val(d.get('description')),supportsAsOf:d.has('supportsAsOf')?val(d.get('supportsAsOf')):false,fields},defaultLimit:val(d.get('defaultLimit')),maxLimit:val(d.get('maxLimit'))};expected.push(row);check(`dataset key ${key}`,key===row.metadata.key);
 const actual=data.datasets.find(x=>x.metadata.key===key);check(`complete dataset metadata/limits ${key}`,isDeepStrictEqual(actual,row));for(const field of fields)check(`exact field ${key}.${field.name}`,isDeepStrictEqual(actual?.metadata.fields.find(f=>f.name===field.name),field));}
check('all original ordered datasets retained',isDeepStrictEqual(data.datasets,expected));check('12 datasets / 88 fields',expected.length===12&&expected.reduce((n,x)=>n+x.metadata.fields.length,0)===88);
const source={repository:'neo-capiro/capirov2',ref:frozen,path:refs[0],blob:references[0].versions[0].blob,sha256:references[0].versions[0].sha256};check('exact source locator and byte hash',isDeepStrictEqual(data.source,source));
check('fixed canonical projection hash',canonicalSha256({source,datasets:expected})==='f9b4dd84165011700f47f4a3f454226b80b4199bdb35436f72c30f7c2d2ff2b4');
const walkData=x=>{if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if(['sql','table','column','expression'].includes(k))throw Error('Private physical/query member emitted');walkData(v);}};walkData(data);check('no physical SQL/column/table/expression properties',true);
const git=(...args)=>execFileSync('git',args,{maxBuffer:8*1024*1024});const tree=ref=>new Map(git('ls-tree','-rz',ref).toString().split('\0').filter(Boolean).map(l=>{const i=l.indexOf('\t');return[l.slice(i+1),l.slice(0,i)];}));
const before=tree(base),after=tree(candidate);check('all base mode/blob entries preserved',[...before].every(([p,v])=>after.get(p)===v));
const files=['public-domain-datasets.json','public-domain-registry.mjs','public-domain-query.schema.json','public-domain-query-validation.mjs'].map(x=>'packages/contracts/retrieval-0.2/'+x).concat('packages/contracts/test/retrieval-public-domain-query.test.mjs');
for(const p of files)check('exercised exact frozen '+p,readFileSync(p).equals(git('show',`${candidate}:${p}`)));
const old='3da3f17ec677f5c3f67435501e723d1ab23d1d26';check('new global source exactly five files',isDeepStrictEqual(git('diff','--name-only',old,candidate,'--','packages/','apps/','scripts/').toString().trim().split('\n').sort(),files.slice().sort()));
const evidence='docs/qualification/candidates/backend-execution-20261012/public-legal-review/';for(const[label,exit]of[['global-first',1],['global-corrected',0]]){const r=JSON.parse(readFileSync(evidence+label+'.json'));check(label+' raw result and cleanup',r.exitCode===exit&&r.ownedProcessGroupAbsent&&!r.timedOut&&r.sourceDiffBytes===0);for(const st of r.streams){const b=readFileSync(st.path);check(label+' raw '+st.path.split('/').at(-1),b.length===st.bytes&&createHash('sha256').update(b).digest('hex')===st.sha256);}}
check('50 focused cases pass',/tests 50/.test(readFileSync(evidence+'global-corrected.stdout.bin','utf8'))&&/fail 0/.test(readFileSync(evidence+'global-corrected.stdout.bin','utf8')));
console.log(JSON.stringify({status:checks.every(x=>x.pass)?'PASS':'FAIL',passed:checks.filter(x=>x.pass).length,total:checks.length,candidate,tree:git('rev-parse',candidate+'^{tree}').toString().trim(),base,originalEntries:before.size,references,checks,scope:'AST metadata extraction and local source controls only; private implementation not imported or executed; no runtime/authority acceptance'},null,2));if(checks.some(x=>!x.pass))process.exitCode=1;
