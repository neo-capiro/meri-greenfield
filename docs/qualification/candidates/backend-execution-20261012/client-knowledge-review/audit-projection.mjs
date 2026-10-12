// Read-only TypeScript AST metadata audit: never imports or executes a producer.
import {pathToFileURL} from 'node:url';
if(!process.argv[3])throw Error('Explicit read-only TypeScript parser path required');
const {default:ts}=await import(pathToFileURL(process.argv[3]).href);
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const pin='fd8765ec01d292013758606204f2c9d886cd31c1',root=new URL('../../../../../',import.meta.url),out=new URL('./',import.meta.url),checks=[];
const check=(label,pass)=>checks.push({label,pass:!!pass});
const hash=x=>createHash('sha256').update(x).digest('hex');
function source(p){const text=execFileSync('git',['-C','/workspace/capirov2','show',`${pin}:${p}`],{encoding:'utf8'});return ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true);}
function nodes(f,predicate){const found=[];function walk(n){if(predicate(n))found.push(n);ts.forEachChild(n,walk);}walk(f);return found;}
const recall=source('apps/api/src/memory/memory-recall-content.helpers.ts');const fn=nodes(recall,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='describeMemoryRecallContent')[0];
const prop=nodes(fn,n=>ts.isPropertyAssignment(n)&&n.name.getText(recall)==='contentLimitation')[0];const expr=prop.initializer;check('limitation conditional AST',ts.isConditionalExpression(expr)&&ts.isConditionalExpression(expr.whenFalse));
const memory=JSON.parse(readFileSync(new URL('packages/contracts/retrieval-0.2/client-knowledge-memory.schema.json',root)));
check('metadata-only exact source literal',memory.$defs.MemoryMetadataOnlyLimitation.const===expr.whenTrue.text);check('empty exact source literal',memory.$defs.MemoryEmptyLimitation.const===expr.whenFalse.whenTrue.text);check('available null source',expr.whenFalse.whenFalse.kind===ts.SyntaxKind.NullKeyword&&memory.$defs.MemoryContentAvailableLimitation.type==='null');
const tools=source('apps/api/src/meri/meri-tools.service.ts');const summarize=nodes(tools,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='summarizeText')[0];const slice=nodes(summarize,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='slice')[0];check('summary prefix max minus three',ts.isBinaryExpression(slice.arguments[1])&&slice.arguments[1].left.getText(tools)==='max'&&slice.arguments[1].right.text==='3');check('summary uses three-dot suffix',nodes(summarize,n=>ts.isTemplateExpression(n)).some(n=>n.templateSpans.at(-1).literal.text==='...'));
const method=nodes(tools,n=>ts.isMethodDeclaration(n)&&n.name.getText(tools)==='getClientContext')[0];const history=nodes(method,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='listClientHistory')[0];check('history unlimited selector null supplied',history.arguments[2].kind===ts.SyntaxKind.NullKeyword);
const people=source('apps/api/src/clients/client-people.service.ts');const list=nodes(people,n=>ts.isMethodDeclaration(n)&&n.name.getText(people)==='listPeople')[0];check('placement overlay from inferred confidence',nodes(list,n=>ts.isPropertyAssignment(n)&&n.name.getText(people)==='placementConfidence').some(n=>n.initializer.getText(people)==='inferred.confidence'));
const profile=JSON.parse(readFileSync(new URL('packages/contracts/retrieval-0.2/client-knowledge-profile.schema.json',root)));const confidence=profile.$defs.ProfileClientPerson.properties.placementConfidence;check('confidence string and numeric distinction retained',JSON.stringify(confidence).includes('"string"')&&JSON.stringify(confidence).includes('"number"')&&JSON.stringify(confidence).includes('"null"'));
const helper=source('apps/api/src/meri/meri-memory-content.helpers.ts');const projection=nodes(helper,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='projectMemoryContent')[0];check('no original source body included in receipt',!!projection);
const result={pin,passed:checks.filter(c=>c.pass).length,total:checks.length,checks,memoryLimitationHashes:{metadataOnly:hash(expr.whenTrue.text),empty:hash(expr.whenFalse.whenTrue.text)},parser:{version:ts.version,sha256:hash(readFileSync(process.argv[3]))},scope:'AST_DATA_ONLY_NO_PRIVATE_EXECUTION'};
const target=new URL(process.argv[2]+'.json',out);if(existsSync(target))throw Error('Refuse overwrite');writeFileSync(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,total:result.total}));process.exitCode=result.passed===result.total?0:1;
