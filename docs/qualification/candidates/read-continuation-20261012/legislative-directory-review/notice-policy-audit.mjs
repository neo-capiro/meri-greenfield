// Parse pinned source text as metadata only. Never import or execute producers.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../../../../..');
const require=createRequire(path.join(root,'packages/contracts/package.json'));
const ts=require('typescript');
const schema=JSON.parse(fs.readFileSync(path.join(root,'packages/contracts/retrieval-0.2/legislative-directory.schema.json')));
const sourcePath='apps/api/src/meri/meri-tools.service.ts';
const raw=execFileSync('git',['-C','/workspace/capirov2','show',`fd8765ec01d292013758606204f2c9d886cd31c1:${sourcePath}`],{encoding:'utf8'});
const file=ts.createSourceFile(sourcePath,raw,ts.ScriptTarget.Latest,true);
const staticValue=n=>ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)?n.text:ts.isParenthesizedExpression(n)?staticValue(n.expression):ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken?combine(staticValue(n.left),staticValue(n.right)):null;
const combine=(a,b)=>typeof a==='string'&&typeof b==='string'?a+b:null;
const values=new Set();function visit(n){const value=staticValue(n);if(typeof value==='string')values.add(value);ts.forEachChild(n,visit);}visit(file);
const checks=['DirectorySelectionNote','DirectoryStateNote','DirectoryEmptyRosterNote','DirectoryFederalRosterNote','DirectoryMemberSelectionNote'].map(name=>({name,bytes:Buffer.byteLength(schema.$defs[name].const),sha256:createHash('sha256').update(schema.$defs[name].const).digest('hex'),exactPinnedStaticPolicy:values.has(schema.$defs[name].const)}));
console.log(JSON.stringify({scope:'data-only pinned notice equality; private strings not published',passed:checks.filter(x=>x.exactPinnedStaticPolicy).length,failed:checks.filter(x=>!x.exactPinnedStaticPolicy).length,typescriptVersion:ts.version,checks},null,2));
if(checks.some(x=>!x.exactPinnedStaticPolicy))process.exitCode=1;
