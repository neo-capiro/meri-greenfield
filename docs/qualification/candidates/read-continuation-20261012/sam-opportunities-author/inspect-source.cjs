// Parse immutable source as data only. Emit field/symbol metadata, never bodies.
const ts=require('/workspace/meri-read-continuation-20261012/packages/contracts/node_modules/typescript');
const {execFileSync}=require('node:child_process');
const filePath=process.argv[2], wanted=new Set(process.argv.slice(3));
const commit=process.env.MERI_DISCOVERY_REF || 'fd8765ec01d292013758606204f2c9d886cd31c1';
if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Exact immutable commit required');
const body=execFileSync('git',['show',commit+':'+filePath],{cwd:'/workspace/capirov2',maxBuffer:4000000}).toString();
const file=ts.createSourceFile(filePath,body,ts.ScriptTarget.Latest,true);
function ref(n){if(!n)return null;return ts.isIdentifier(n)?n.text:n.kind===ts.SyntaxKind.ThisKeyword?'this':ts.isPropertyAccessExpression(n)?(ref(n.expression)||'<expression>')+'.'+n.name.text:null;}
function field(p){return {name:p.name?.getText(file)||'[spread]',kind:ts.SyntaxKind[p.initializer?.kind||p.kind],reference:ref(p.initializer)};}
function visit(n){const name=n.name&&ref(n.name);if(name&&wanted.has(name)&&(ts.isMethodDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isInterfaceDeclaration(n))){
 const calls=new Set(),selectors=[],shapes=[],returns=[];
 function walk(x){if(ts.isCallExpression(x)){const c=ref(x.expression);if(c)calls.add(c);if(c&&/optionalString|requiredString|clampInt|optionalBoolean|requiredNumber/.test(c))selectors.push({helper:c,args:x.arguments.map(a=>ts.isStringLiteral(a)?a.text:ts.isNumericLiteral(a)?Number(a.text):ref(a)||ts.SyntaxKind[a.kind])});}
 if(ts.isObjectLiteralExpression(x))shapes.push({line:file.getLineAndCharacterOfPosition(x.getStart(file)).line+1,fields:x.properties.map(field)});
 if(ts.isReturnStatement(x)&&x.expression)returns.push({line:file.getLineAndCharacterOfPosition(x.getStart(file)).line+1,kind:ts.SyntaxKind[x.expression.kind],reference:ref(x.expression)});
 ts.forEachChild(x,walk);}
 walk(n);console.log(JSON.stringify({commit,path:filePath,symbol:name,line:file.getLineAndCharacterOfPosition(n.getStart(file)).line+1,end:file.getLineAndCharacterOfPosition(n.end).line+1,parameters:n.parameters?.map(p=>({name:ref(p.name),type:ref(p.type?.typeName)||ts.SyntaxKind[p.type?.kind]})),members:n.members?.map(m=>({name:ref(m.name),optional:!!m.questionToken,type:ref(m.type?.typeName)||ts.SyntaxKind[m.type?.kind]})),selectors,calls:[...calls],shapes,returns}));
 } ts.forEachChild(n,visit);}visit(file);
