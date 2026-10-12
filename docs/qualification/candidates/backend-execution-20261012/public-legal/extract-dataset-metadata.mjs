// Read pinned private source as syntax only; never import/evaluate its implementation.
import ts from '/workspace/meri-read-continuation-20261012/packages/contracts/node_modules/typescript/lib/typescript.js';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo='/workspace/capirov2',ref='fd8765ec01d292013758606204f2c9d886cd31c1';
const path='apps/api/src/meri/analytics/global-dataset-registry.ts';
const bytes=execFileSync('git',['-C',repo,'show',`${ref}:${path}`]);
const ast=ts.createSourceFile(path,bytes.toString('utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const constants=new Map();let registry;
for(const stmt of ast.statements)if(ts.isVariableStatement(stmt))for(const dec of stmt.declarationList.declarations){
 if(dec.name.getText(ast)==='GLOBAL_DATASET_REGISTRY')registry=dec.initializer;
 else if(dec.initializer&&ts.isStringLiteral(dec.initializer))constants.set(dec.name.getText(ast),dec.initializer.text);
}
function scalar(node){
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isNumericLiteral(node))return Number(node.text);
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true;if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isTemplateExpression(node)){let s=node.head.text;for(const span of node.templateSpans){const name=span.expression.getText(ast);if(!constants.has(name))throw Error('Unclosed metadata interpolation');s+=constants.get(name)+span.literal.text;}return s;}
 throw Error('Metadata value is not a supported literal');
}
function properties(node){if(!ts.isObjectLiteralExpression(node))throw Error('Metadata object unavailable');return new Map(node.properties.map(p=>{if(!ts.isPropertyAssignment(p))throw Error('Dynamic metadata property');return [p.name.getText(ast).replace(/^['"]|['"]$/g,''),p.initializer];}));}
const datasets=[];
for(const [name,node] of properties(registry)){
 const r=properties(node),fields=[];
 for(const [field,fnode]of properties(r.get('fields'))){const f=properties(fnode),type=scalar(f.get('type'));fields.push({name:field,type,description:scalar(f.get('description')),filterable:f.has('filterable')?scalar(f.get('filterable')):true,groupable:f.has('groupable')?scalar(f.get('groupable')):true,aggregatable:type==='number'});}
 const key=scalar(r.get('key'));if(key!==name)throw Error('Registry key mismatch');
 datasets.push({metadata:{key,description:scalar(r.get('description')),supportsAsOf:r.has('supportsAsOf')?scalar(r.get('supportsAsOf')):false,fields},defaultLimit:scalar(r.get('defaultLimit')),maxLimit:scalar(r.get('maxLimit'))});
}
const result={source:{repository:'neo-capiro/capirov2',ref,path,blob:execFileSync('git',['-C',repo,'rev-parse',`${ref}:${path}`]).toString().trim(),sha256:createHash('sha256').update(bytes).digest('hex')},datasets};
writeFileSync('packages/contracts/retrieval-0.2/public-domain-datasets.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({datasets:datasets.length,fields:datasets.reduce((n,d)=>n+d.metadata.fields.length,0),sqlOrPrivateBodiesEmitted:false,implementationExecuted:false}));
