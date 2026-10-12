// Read-only AST/data inspection of immutable references. Never imports/executes them.
import ts from '../../../../../packages/contracts/node_modules/typescript/lib/typescript.js';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const referenceCommit = 'fd8765ec01d292013758606204f2c9d886cd31c1';
const observedCommit = '4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace';
const git = (...args) => execFileSync('git', ['-C', '/workspace/capirov2', ...args]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const metadata = JSON.parse(readFileSync(new URL('../integration/registry-reference-metadata.json', import.meta.url)));
const checks = [];
const check = (name, value) => checks.push({name, pass: Boolean(value)});
const inputs = new Map();
const identities = metadata.references.map(reference => {
  const bytes = git('show', `${referenceCommit}:${reference.path}`);
  const blob = git('rev-parse', `${referenceCommit}:${reference.path}`).toString().trim();
  const currentBlob = git('rev-parse', `${observedCommit}:${reference.path}`).toString().trim();
  check(`pinned-bytes:${reference.path}`, hash(bytes) === reference.sha256 && blob === reference.blob);
  check(`no-observed-drift:${reference.path}`, currentBlob === blob && currentBlob === reference.currentBlob);
  inputs.set(reference.path, bytes.toString());
  return {path: reference.path, bytes: bytes.length, sha256: hash(bytes), blob, currentBlob};
});
const servicePath = 'apps/api/src/meri/meri-tools.service.ts';
const service = ts.createSourceFile(servicePath, inputs.get(servicePath), ts.ScriptTarget.Latest, true);
const declarations = new Map();
function walk(node, visit) {visit(node); ts.forEachChild(node, child => walk(child, visit));}
walk(service, node => {
  if ((ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name)
    declarations.set(node.name.getText(service), node);
});
const method = declarations.get('lookupClientRegistry');
const line = node => service.getLineAndCharacterOfPosition(node.getStart(service)).line + 1;
const calls = [], objects = [], properties = [], binaries = [];
walk(method, node => {
  if (ts.isCallExpression(node)) calls.push(node);
  if (ts.isObjectLiteralExpression(node)) objects.push(node);
  if (ts.isPropertyAssignment(node)) properties.push(node);
  if (ts.isBinaryExpression(node)) binaries.push(node);
});
const callee = node => ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : null;
const fieldNames = node => node.properties.map(field => field.name?.getText(service)).sort();
const fields = expected => objects.some(node => JSON.stringify(fieldNames(node)) === JSON.stringify([...expected].sort()));
check('required-name-limit300', calls.some(node => callee(node) === 'requiredString' && node.arguments.some(arg => ts.isNumericLiteral(arg) && arg.text === '300')));
check('tenant-and-global-access-are-distinct', calls.filter(node => callee(node) === 'withTenant').length === 1 && calls.filter(node => callee(node) === 'withSystem').length === 2);
check('tenant-projection-three-fields', fields(['id','name','website']));
check('lda-projection-six-fields', fields(['ldaClientId','name','state','description','totalFilings','latestFilingYear']));
check('result-projection-four-fields', fields(['existingClient','ldaExactMatch','ldaCandidates','guidance']));
check('candidate-source-limit-five', properties.some(node => node.name.getText(service) === 'take' && ts.isNumericLiteral(node.initializer) && node.initializer.text === '5'));
check('description-summary-limit200', calls.some(node => callee(node) === 'summarizeText' && node.arguments.some(arg => ts.isNumericLiteral(arg) && arg.text === '200')));
check('candidate-exact-identity-exclusion', binaries.some(node => node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'id' && ts.isPropertyAccessExpression(node.right) && node.right.name.text === 'id'));
const pick = declarations.get('LdaPick');
const pickFields = Object.fromEntries(pick.type.members.map(member => [member.name.getText(service), member.type.getText(service)]));
check('LdaPick-scalars-and-nullability', JSON.stringify(pickFields) === JSON.stringify({id:'number',name:'string',state:'string | null',generalDescription:'string | null',totalFilings:'number',latestFilingYear:'number | null'}));
const optional = declarations.get('optionalString');
const optionalCalls = []; walk(optional, node => {if (ts.isCallExpression(node)) optionalCalls.push(node);});
check('selector-trim-then-UTF16-slice', optionalCalls.some(node => callee(node) === 'trim') && optionalCalls.some(node => callee(node) === 'slice' && ts.isNumericLiteral(node.arguments[0]) && node.arguments[0].text === '0' && node.arguments[1]?.getText(service) === 'max'));
const summary = declarations.get('summarizeText');
const summaryCalls = [], templates = [], comparisons = [];
walk(summary, node => {
  if (ts.isCallExpression(node)) summaryCalls.push(node);
  if (ts.isTemplateExpression(node)) templates.push(node);
  if (ts.isBinaryExpression(node)) comparisons.push(node);
});
check('summary-bound-measured-in-JS-string-length', comparisons.some(node => node.operatorToken.kind === ts.SyntaxKind.GreaterThanToken && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'length' && node.right.getText(service) === 'max'));
check('summary-truncation-reserves-three-units-for-tail', summaryCalls.some(node => callee(node) === 'slice' && ts.isBinaryExpression(node.arguments[1]) && node.arguments[1].operatorToken.kind === ts.SyntaxKind.MinusToken && node.arguments[1].left.getText(service) === 'max' && ts.isNumericLiteral(node.arguments[1].right) && node.arguments[1].right.text === '3') && templates.some(node => node.templateSpans.length === 1 && node.templateSpans[0].literal.text.length === 3));
const prisma = inputs.get('apps/api/prisma/schema.prisma');
const storage = {};
for (const [model, expected] of Object.entries({Client:{id:'String',name:'String',website:'String?'},LdaClient:{id:'Int',name:'String',state:'String?',generalDescription:'String?',totalFilings:'Int',latestFilingYear:'Int?'}})) {
  const body = new RegExp(`^model ${model} \\{([\\s\\S]*?)^}`, 'm').exec(prisma)[1];
  storage[model] = Object.fromEntries(Object.keys(expected).map(field => [field, new RegExp(`^\\s*${field}\\s+(\\S+)`, 'm').exec(body)?.[1]]));
  check(`storage-scalar-projection:${model}`, JSON.stringify(storage[model]) === JSON.stringify(expected));
}
const spec = ts.createSourceFile('registry-reference-spec.ts', inputs.get('apps/api/src/meri/meri-tools.create-client.spec.ts'), ts.ScriptTarget.Latest, true);
const outcomeLocations = [];
walk(spec, node => {
  if (ts.isCallExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === 'lookupClientRegistry') || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'lookupClientRegistry') || (ts.isElementAccessExpression(node.expression) && ts.isStringLiteral(node.expression.argumentExpression) && node.expression.argumentExpression.text === 'lookupClientRegistry')))
    outcomeLocations.push(spec.getLineAndCharacterOfPosition(node.getStart(spec)).line + 1);
});
check('reference-tests-exercise-lookup', outcomeLocations.length >= 4);
const result = {referenceCommit, observedCommit, identities, checks, passed:checks.filter(row=>row.pass).length,
  failed:checks.filter(row=>!row.pass).length, declarationLines:Object.fromEntries(['lookupClientRegistry','requiredString','optionalString','LdaPick','summarizeText'].map(name=>[name,line(declarations.get(name))])),
  sourceProjectionFields:{tenantClient:['id','name','website'],lda:['ldaClientId','name','state','description','totalFilings','latestFilingYear'],result:['existingClient','ldaExactMatch','ldaCandidates','guidance']},
  storage, outcomeLocations, privateSourceBodiesPublished:false, privateSourceExecuted:false,
  limits:['Reference queries are observations of frozen source, not actual authorization/current source availability.', 'UTF-16 description limit is proven by helper source; JSON Schema Unicode maxLength alone is insufficient.', 'No success projection proves absence, freshness, full enumeration or grants.']};
console.log(JSON.stringify(result,null,2));
process.exitCode = result.failed ? 1 : 0;
