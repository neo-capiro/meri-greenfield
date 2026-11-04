import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_ROUTE_PATTERNS} from '../control-route-boundary.mjs';
import {compileRoutePatterns,routePattern} from '../telemetry/route-counters.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {BROWSER_RUN_OPERATIONS} from '../../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {CHILD_DISPATCH_OPERATION,CHILD_SETTLE_OPERATION} from '../../control/conversations/lifecycle/child-assignments.mjs';
import {NATIVE_READ_OPERATIONS} from '../reads-http.mjs';
import {SELECTED_OPERATIONS} from '../../../packages/contracts/runtime-0.2/selected.mjs';
import {NATIVE_FILE_PATHS} from '../artifacts/native-files-http.mjs';
import {CONTROL_HTTP_PATHS} from '../agentcore-control-http.mjs';
import {RUNNER_INTENT_PATHS} from '../native-authority/intents-client.mjs';
import {OBJECTIVE_ACTIVITY_OPERATIONS} from '../native-authority/objective-runs-http.mjs';
import {ROUTINES_OCCURRENCE_OPERATIONS} from '../native-authority/routines-occurrence-http.mjs';
import {workspaceGenerationPaths} from '../../control/conversations/workspace-generation/protocol.mjs';
import {USER_PREFERENCES_PATHS} from '../../control/settings/user-application/protocol.mjs';
import {TENANT_SETTINGS_PATHS} from '../../control/settings/tenant-application/protocol.mjs';
import {MEMORY_PATHS} from '../../control/memory/protocol.mjs';
import {ROUTINE_PATHS} from '../../control/schedules/application-http.mjs';
import {taskCommandPaths} from '../../../packages/contracts/task-command-application/protocol.mjs';
import {OFFICE_ROUTES} from '../../../packages/contracts/office-application/receive.mjs';
import {BROWSER_VIEWER_ROUTES} from '../../../packages/contracts/browser-viewer/receive.mjs';
const uuid='11111111-1111-4111-8111-111111111111';
const tables={public:compileRoutePatterns(CONTROL_ROUTE_PATTERNS.public),private:compileRoutePatterns(CONTROL_ROUTE_PATTERNS.private)};
const expect=(listener,path,pattern=path)=>assert.equal(routePattern(path,tables[listener]),pattern,`${listener} ${path}`);

test('the control route allowlist is closed, well-formed and names the routes the listeners actually answer',()=>{
 for(const listener of ['public','private'])assert.equal(new Set(CONTROL_ROUTE_PATTERNS[listener]).size,CONTROL_ROUTE_PATTERNS[listener].length,listener+' has no duplicate pattern');
 expect('public','/api/action-followthrough/session');expect('public','/api/conversations/input/admit');expect('public','/api/conversations/list');
 expect('public',`/api/conversations/events/${uuid}/stream`,'/api/conversations/events/:id/stream');
 expect('public','/api/uploads/original/'+uuid,'/api/uploads/original/:id');expect('public','/api/documents/download');expect('public','/api/data-access/read');
 for(const operation of ['canvas-read','canvas-save']){expect('public','/api/documents/'+operation);expect('private','/api/documents/'+operation,'other');expect('public','/api/documents/'+operation+'/extra','other');}
 expect('private','/api/meri/office/wopi/files/0123456789abcdef0123456789abcdef/contents','/api/meri/office/wopi/files/:id/contents');
 expect('private','/v1/internal/workspace-generation/turn');
 // The other listener's routes, unknown paths, dead routes and identifier-shaped segments fold into `other` before any counting.
 expect('private','/api/conversations/list','other');expect('public','/internal/conversations/publish','other');
 for(const path of ['/health/live','/api/conversations/'+uuid+'/history','/api/conversations/01ARZ3NDEKTSV4RRFFQ69G5FAV','/api/conversations/jane.doe','/api/conversations/V1StGXR8_Z5jdHi6B-myT','/api/tasks/list','/api/conversations/list/extra'])expect('public',path,'other');
 for(const path of ['/v1/selected/read','/v1/native-task/prepare','/v1/runner-poststart/challenge','/v1/runner/native/start','/v1/checkpoint/read','/v1/context/resolve','/v1/identity/verify','/v1/worker/authorize','/v1/execution/poll','/v1/native-processing/lifecycle'])expect('private',path,'other');
});

test('every route in the tables the listeners dispatch on classifies to itself, never to other',()=>{
 const runner=[...Object.keys(runOwnerOperations),CHILD_DISPATCH_OPERATION,CHILD_SETTLE_OPERATION,...Object.keys(BROWSER_RUN_OPERATIONS),...SELECTED_OPERATIONS.map(o=>'selected/'+o)];
 const privateRoutes=[
  ...runner.map(o=>'/internal/conversations/'+o),...runner.map(o=>'/v1/runner/'+o),
  ...NATIVE_READ_OPERATIONS.map(o=>'/v1/runner/reads/'+o),...[...sdkSessionOperations,'snapshot'].map(o=>'/v1/runner/session/'+o),
  '/v1/runner/runtime','/v1/runner/outreach/complete','/v1/runner/outreach/fail',
  ...Object.values(RUNNER_INTENT_PATHS),...Object.keys(NATIVE_FILE_PATHS),...CONTROL_HTTP_PATHS,
  ...Object.values(OBJECTIVE_ACTIVITY_OPERATIONS).map(o=>'/v1/'+o),...Object.values(ROUTINES_OCCURRENCE_OPERATIONS).map(o=>'/v1/'+o),...Object.values(workspaceGenerationPaths),
 ];
 assert.ok(privateRoutes.includes('/v1/runner/session/register')&&privateRoutes.includes('/v1/runner/session/list-subkeys')&&privateRoutes.includes('/v1/runner/reads/availability')&&privateRoutes.includes('/internal/conversations/selected/prepare')&&privateRoutes.includes('/v1/runner/selected/publish'));
 for(const path of privateRoutes)expect('private',path);
 const publicRoutes=[...OFFICE_ROUTES.map(r=>'/api/meri/office/'+r),...BROWSER_VIEWER_ROUTES.map(r=>'/api/meri/browser/'+r),...Object.values(USER_PREFERENCES_PATHS),...Object.values(TENANT_SETTINGS_PATHS),
  ...Object.values(MEMORY_PATHS),...Object.values(ROUTINE_PATHS),...Object.values(taskCommandPaths)];
 for(const path of publicRoutes)expect('public',path);
});
