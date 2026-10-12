// Inspect private Git bytes only; emit hashes and assertion names, never bodies.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const ts=require('../../../../../packages/contracts/node_modules/typescript');
const pins=JSON.parse(fs.readFileSync('docs/qualification/candidates/read-continuation-20261012/next-discovery/congressional-reference-identities.json'));
const results=[], check=(name,ok)=>{results.push({name,passed:!!ok});};
const read=(commit,path)=>cp.execFileSync('git',['show',`${commit}:${path}`],{cwd:'/workspace/capirov2',maxBuffer:2000000});
const blobs=new Map();
for(const pin of pins.references){const data=read(pins.sourceCommit,pin.path);blobs.set(pin.path,data.toString());check(`${pin.path}: byte size`,data.length===pin.bytes);check(`${pin.path}: SHA256`,crypto.createHash('sha256').update(data).digest('hex')===pin.sha256);check(`${pin.path}: observed bytes unchanged`,data.equals(read(pins.observedCommit,pin.path)));}
const tool=ts.createSourceFile('tool.ts',blobs.get('apps/api/src/meri/meri-tools.service.ts'),ts.ScriptTarget.Latest,true);
const methods=new Map();function walk(n){if(ts.isMethodDeclaration(n)&&n.name)methods.set(n.name.getText(tool),n);ts.forEachChild(n,walk)}walk(tool);
for(const symbol of ['searchCongressBills','readBillText','locatedBillText']){const n=methods.get(symbol);check(`${symbol}: exists`,!!n);check(`${symbol}: no actor authority parameters`,n.parameters.every(p=>p.name.getText(tool)==='input'||['billId','row','query'].includes(p.name.getText(tool))));}
const schema=blobs.get('apps/api/prisma/schema.prisma'),model=schema.match(/model CongressBill \{([\s\S]*?)\n\}/)[1];
const fields=new Map(model.split('\n').map(l=>l.trim().match(/^(\w+)\s+([\w?\[\]]+)/)).filter(Boolean).map(x=>[x[1],x[2]]));
for(const [key,type] of [['committees','Json'],['subjects','String[]'],['peCodes','String[]'],['cosponsorsCount','Int'],['introducedDate','DateTime?'],['lastSyncedAt','DateTime']])check(`CongressBill ${key}: ${type}`,fields.get(key)===type);
const helper=ts.createSourceFile('helper.ts',blobs.get('apps/api/src/meri/meri-bill-text-search.ts'),ts.ScriptTarget.Latest,true),constants=new Map();function vars(n){if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isNumericLiteral(n.initializer))constants.set(n.name.getText(helper),Number(n.initializer.text));ts.forEachChild(n,vars)}vars(helper);
for(const [key,value] of [['BILL_TEXT_PAGE_CHARS',9000],['BILL_TEXT_PASSAGE_CHARS',1000],['MAX_BILL_TEXT_PASSAGES',6],['BILL_TEXT_RESPONSE_BUDGET',10500],['BILL_TEXT_BILLS_PER_PAGE',8],['BILL_TEXT_MAX_BILLS_PER_PAGE',10]])check(`${key}=${value}`,constants.get(key)===value);
const result={scope:'SOURCE_METADATA_ONLY',source:pins.sourceCommit,observed:pins.observedCommit,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results};
console.log(JSON.stringify(result,null,2));process.exitCode=result.failed?1:0;
