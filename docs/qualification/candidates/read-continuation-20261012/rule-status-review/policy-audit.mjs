// Read and parse pinned policy as metadata. No producer import or execution.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../../../../..'),require=createRequire(path.join(root,'packages/contracts/package.json')),ts=require('typescript');
const schema=JSON.parse(fs.readFileSync(path.join(root,'packages/contracts/retrieval-0.2/rule-status.schema.json')));
const pin='fd8765ec01d292013758606204f2c9d886cd31c1';
const parse=p=>ts.createSourceFile(p,execFileSync('git',['-C','/workspace/capirov2','show',`${pin}:${p}`],{encoding:'utf8'}),ts.ScriptTarget.Latest,true);
const scalar=n=>{if(!n)return undefined;if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;if(ts.isParenthesizedExpression(n)||ts.isAsExpression(n))return scalar(n.expression);if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=scalar(n.left),b=scalar(n.right);return typeof a==='string'&&typeof b==='string'?a+b:undefined;}if(ts.isArrayLiteralExpression(n))return n.elements.map(scalar);if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text,scalar(p.initializer)]));return undefined;};
const wrapper=parse('apps/api/src/meri/meri-tools.service.ts'),policy=parse('packages/shared/src/index.ts'),strings=new Set(),constants={};let thresholds={};
function walk(n){const value=scalar(n);if(typeof value==='string')strings.add(value);ts.forEachChild(n,walk);}walk(wrapper);
function shared(n){if(ts.isVariableDeclaration(n)&&['RULE_LIFECYCLE_STAGES','COMMENT_ACCEPTING_STAGES'].includes(n.name?.text))constants[n.name.text]=scalar(n.initializer);ts.forEachChild(n,shared);}shared(policy);
const checks=[];const check=(name,passed)=>checks.push({name,passed:!!passed});
for(const name of ['RuleStatusMissingNote','RuleStatusMissingDeadlineNote','RuleStatusStateCoverage'])check(name+' exact static producer policy',strings.has(schema.$defs[name].const));
const labels=Object.fromEntries(constants.RULE_LIFECYCLE_STAGES.map(x=>[x.key,x.label]));check('five exact shared labels',JSON.stringify(labels)===JSON.stringify(schema.$defs.RuleStatusLabels.const));check('comment accepting stages',JSON.stringify(constants.COMMENT_ACCEPTING_STAGES)===JSON.stringify(schema.$defs.RuleStatusCommentStages.const));
// Compare exact accepted type vocabulary against immutable switch literals; group ownership is separately reviewed from branch returns.
let cases=[];function types(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='deriveRuleLifecycleStage'){function inner(x){if(ts.isCaseClause(x))cases.push(x.expression.text);ts.forEachChild(x,inner);}inner(n);}else ts.forEachChild(n,types);}types(policy);
const expected={PROPOSED_RULE:'proposed',PROPOSED:'proposed',RULE:'final',FINAL:'final',PRESIDENTIAL_DOCUMENT:'final',EXECUTIVE_ORDER:'final',EMERGENCY:'final',NOTICE:'notice'};
check('shared switch source names',JSON.stringify(cases)===JSON.stringify(Object.keys(expected)));check('schema type groups match independently inspected switch',JSON.stringify(schema.$defs.RuleStatusTypeStages.const)===JSON.stringify(expected));
console.log(JSON.stringify({scope:'private-source AST/data only; no private bodies published',typescriptVersion:ts.version,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,labelsSha256:createHash('sha256').update(JSON.stringify(labels)).digest('hex'),checks},null,2));if(checks.some(x=>!x.passed))process.exitCode=1;
