// Read immutable private source as data and publish metadata only. Never import it.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../..');
const ts=require(path.join(root,'packages/contracts/node_modules/typescript'));
const sourcePin='fd8765ec01d292013758606204f2c9d886cd31c1',observedPin='4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace';
const paths=['apps/api/src/meri/meri-tools.service.ts','apps/api/src/regulatory-docket/regulatory-docket.service.ts','apps/api/prisma/schema.prisma','apps/api/src/meri/meri.controller.ts','apps/api/src/auth/roles.guard.ts','apps/api/src/meri/meri-tool-request-control.ts','apps/api/src/meri/tool-service-secret.guard.ts'];
const git=(...a)=>execFileSync('git',a,{cwd:'/workspace/capirov2',maxBuffer:4000000});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const checks=[],references=[],sources={};
const check=(name,pass)=>checks.push({name,pass:!!pass});
for(const name of paths){
 const versions={};for(const [label,commit]of[['frozen',sourcePin],['observed',observedPin]]){const bytes=git('show',`${commit}:${name}`);versions[label]={blob:git('rev-parse',`${commit}:${name}`).toString().trim(),bytes:bytes.length,sha256:sha(bytes)};if(label==='frozen')sources[path.basename(name)]=bytes.toString();}
 const unchanged=JSON.stringify(versions.frozen)===JSON.stringify(versions.observed);references.push({path:name,...versions,unchanged});check(`no drift: ${name}`,unchanged);
}
const parse=name=>ts.createSourceFile(name,sources[name],ts.ScriptTarget.Latest,true);
const walk=(n,f)=>{f(n);ts.forEachChild(n,c=>walk(c,f));};
const ref=n=>!n?null:ts.isIdentifier(n)?n.text:n.kind===ts.SyntaxKind.ThisKeyword?'this':ts.isPropertyAccessExpression(n)?`${ref(n.expression)}.${n.name.text}`:null;
const find=(file,name)=>{let found;walk(file,n=>{if(n.name&&ref(n.name)===name&&(ts.isMethodDeclaration(n)||ts.isFunctionDeclaration(n)))found=n;});if(!found)throw Error('Missing declared symbol');return found;};
const calls=n=>{const list=[];walk(n,x=>{if(ts.isCallExpression(x))list.push(x);});return list;};
const objects=n=>{const list=[];walk(n,x=>{if(ts.isObjectLiteralExpression(x))list.push(x.properties.map(p=>p.name?.text||'[spread]'));});return list;};
const literal=n=>ts.isStringLiteral(n)?n.text:ts.isNumericLiteral(n)?Number(n.text):ref(n);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const wrapper=parse('meri-tools.service.ts'),service=parse('regulatory-docket.service.ts');
const query=find(wrapper,'queryRegulatoryDockets'),ordinary=find(service,'listDockets'),upcoming=find(service,'getUpcomingDeadlines');
const wc=calls(query),oc=calls(ordinary),uc=calls(upcoming);
check('wrapper limit/day clamp metadata',same(wc.filter(n=>ref(n.expression)==='clampInt').map(n=>n.arguments.map(literal)),[['input.limit',1,50,20],['input.days',1,365,30]]));
check('wrapper optional selector metadata',same(wc.filter(n=>ref(n.expression)==='optionalString').map(n=>n.arguments.map(literal)),[['input','agencyId',40],['input','documentType',80]]));
check('wrapper upcoming selector uses optionalBoolean',wc.some(n=>ref(n.expression)==='optionalBoolean'&&same(n.arguments.map(literal),['input','upcomingOnly'])));
check('wrapper both exact projected envelopes',objects(query).some(v=>same(v,['tool','generatedAt','windowDays','total','results']))&&objects(query).some(v=>same(v,['tool','generatedAt','total','results'])));
const totalRefs=[];walk(query,n=>{if(ts.isPropertyAssignment(n)&&n.name.text==='total')totalRefs.push(ref(n.initializer));});
check('window total precedes slicing, ordinary separate total',same(totalRefs,['deadlines.length','result.total'])&&wc.some(n=>ref(n.expression)==='deadlines.slice'&&same(n.arguments.map(literal),[0,'limit'])));
check('ordinary two separate observations',oc.some(n=>ref(n.expression)==='Promise.all')&&oc.filter(n=>ref(n.expression)==='this.prisma.regulatoryDocket.findMany').length===1&&oc.filter(n=>ref(n.expression)==='this.prisma.regulatoryDocket.count').length===1);
check('upcoming only one stored findMany',uc.filter(n=>ref(n.expression)==='this.prisma.regulatoryDocket.findMany').length===1&&!uc.some(n=>ref(n.expression)?.endsWith('.count')));
const props=n=>{const p=[];walk(n,x=>{if(ts.isPropertyAssignment(x))p.push([x.name.text,x.initializer]);});return p;};
check('ordinary postedDate descending',props(ordinary).some(([name,v])=>name==='postedDate'&&literal(v)==='desc'));
check('upcoming exact take50 ascending enddates nonwithdrawn',props(upcoming).some(([n,v])=>n==='take'&&literal(v)===50)&&props(upcoming).some(([n,v])=>n==='commentEndDate'&&literal(v)==='asc')&&props(upcoming).some(([n,v])=>n==='withdrawn'&&v.kind===ts.SyntaxKind.FalseKeyword));
check('upcoming inclusive clock endpoints',props(upcoming).some(([n,v])=>n==='gte'&&ref(v)==='now')&&props(upcoming).some(([n,v])=>n==='lte'&&ref(v)==='cutoff'));
function elapsed(n){if(ts.isNumericLiteral(n))return Number(n.text);if(ts.isIdentifier(n)&&n.text==='days')return 1;if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AsteriskToken)return elapsed(n.left)*elapsed(n.right);return NaN;}
let elapsedWindow=false;walk(upcoming,n=>{if(ts.isNewExpression(n)&&ref(n.expression)==='Date'&&n.arguments?.length===1){const a=n.arguments[0];if(ts.isBinaryExpression(a)&&a.operatorToken.kind===ts.SyntaxKind.PlusToken&&ts.isCallExpression(a.left)&&ref(a.left.expression)==='now.getTime'&&elapsed(a.right)===86400000)elapsedWindow=true;}});
check('upcoming cutoff is elapsed milliseconds not calendar arithmetic',elapsedWindow&&!uc.some(n=>ref(n.expression)?.includes('setDate')));
check('two wrapper generatedAt clocks distinct from service query clock',(()=>{let n=0;walk(query,x=>{if(ts.isNewExpression(x)&&ref(x.expression)==='Date')n++;});return n===2;})());
check('selected service methods contain no mutation/provider calls',[...oc,...uc].every(n=>!/fetch|\.create$|\.update$|\.upsert$|\.delete$|\.executeRaw/.test(ref(n.expression)||'')));
const m=sources['schema.prisma'].match(/model RegulatoryDocket\s*\{([\s\S]*?)\n\}/);
const fields=Object.fromEntries(m[1].split('\n').map(line=>line.trim().match(/^(\w+)\s+(\S+)/)).filter(Boolean).map(a=>[a[1],a[2]]));
check('exact fourteen raw scalar field types',same(fields,{id:'String',documentId:'String',agencyId:'String',docketId:'String?',documentType:'String',title:'String',postedDate:'DateTime?',commentStartDate:'DateTime?',commentEndDate:'DateTime?',frDocNum:'String?',subtype:'String?',withdrawn:'Boolean',lastModified:'DateTime?',syncedAt:'DateTime'}));
check('generic string primary key and separate unique document key',/^\s*id\s+String\s+.*@id/m.test(m[1])&&!/^\s*id\s+.*@db\.Uuid/m.test(m[1])&&/^\s*documentId\s+String\s+.*@unique/m.test(m[1]));
const controller=parse('meri.controller.ts');const cc=calls(controller);
check('shared role and trusted tenant/service route guards',cc.some(n=>ref(n.expression)==='Roles'&&n.arguments.some(x=>literal(x)==='standard_user'))&&cc.some(n=>ref(n.expression)==='UseGuards'&&n.arguments.some(x=>ref(x)==='RolesGuard'))&&cc.some(n=>ref(n.expression)==='CurrentTenant')&&cc.some(n=>ref(n.expression)==='UseGuards'&&n.arguments.some(x=>ref(x)==='ToolServiceSecretGuard')));
check('active request check in scoped dispatcher',calls(find(wrapper,'executeScoped')).some(n=>ref(n.expression)==='assertMeriToolRequestActive'));
const locators=[['apps/api/src/meri/meri-tools.service.ts',wrapper,query],['apps/api/src/regulatory-docket/regulatory-docket.service.ts',service,ordinary],['apps/api/src/regulatory-docket/regulatory-docket.service.ts',service,upcoming]].map(([file,ast,node])=>({path:file,symbol:node.name.text,start:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,end:ast.getLineAndCharacterOfPosition(node.end).line+1}));
const result={sourcePin,observedPin,references,locators,projectedFieldTypes:fields,privateBodiesPublished:false,privateSourceExecuted:false,checks:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,results:checks};
fs.writeFileSync(path.join(__dirname,'reference-identities.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks:result.checks,passed:result.passed,failed:result.failed}));process.exitCode=result.failed?1:0;
