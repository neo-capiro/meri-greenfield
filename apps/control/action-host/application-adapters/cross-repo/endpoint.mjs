/** Executes pinned endpoint owners. Nest routing/DI and all external I/O are fixture ports. */
import * as crypto from 'node:crypto';
import * as util from 'node:util';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readPinnedSource} from './source.mjs';
export function createPinnedEndpoint({sourceRepository,typescriptModulePath,now,prisma,clerkSdk}){
 const source=readPinnedSource({sourceRepository,typescriptModulePath}),metadata=new WeakMap();
 const put=(target,key,value)=>{const m=metadata.get(target)??{};m[key]=value;metadata.set(target,m);};
 const decorator=(key,value)=>(target,name,descriptor)=>put(descriptor?.value??target,key,value);
 class HttpError extends Error{constructor(status){super('PINNED_ENDPOINT_REFUSED');this.status=status;}}
 const nest={Injectable:()=>x=>x,Optional:()=>()=>{},Controller:p=>decorator('controller',p),UseGuards:(...v)=>decorator('guards',v),Post:p=>decorator('path',p),HttpCode:n=>decorator('status',n),Header:(k,v)=>(t,n,d)=>{const value=d?.value??t;put(value,'headers',{...metadata.get(value)?.headers,[k]:v});},Req:()=>()=>{},Body:()=>()=>{},SetMetadata:(k,v)=>decorator(k,v),Logger:class{log(){}warn(){}error(){}},ForbiddenException:class extends HttpError{constructor(){super(403);}},UnauthorizedException:class extends HttpError{constructor(){super(401);}},BadRequestException:class extends HttpError{constructor(){super(400);}},NotFoundException:class extends HttpError{constructor(){super(404);}},ConflictException:class extends HttpError{constructor(){super(409);}}};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now()]));}static now(){return now();}}
 const globals={Date:ClockDate,...nest,CurrentTenant:()=>()=>{},createHash:crypto.createHash};
 const compile=(p,imports={},selection,extra={})=>source.compile(p,{'@nestjs/common':nest,...imports},{...globals,...extra},selection);
 const shared=compile('packages/shared/src/index.ts',{}, {declarations:['ROLE_RANK','TENANT_HEADER','authDeniedEvent','CLERK_ADMIN_ROLE_KEYS','isClerkOrgAdminRole']});
 const roles=compile('apps/api/src/auth/roles.decorator.ts');
 const contract=compile('apps/api/src/auth/application-authority.ts',{'node:crypto':crypto,'node:util':util});
 const clerkModule=compile('apps/api/src/auth/clerk.service.ts',{'@clerk/backend':clerkSdk});
 const roleUtil=compile('apps/api/src/auth/clerk-role.util.ts',{'@capiro/shared':shared});
 const storeModule=compile('apps/api/src/tenant/tenant-context.store.ts',{'node:async_hooks':{AsyncLocalStorage}});
 const middleware=compile('apps/api/src/tenant/tenant-context.middleware.ts',{'@capiro/shared':shared,'../auth/clerk-role.util.js':roleUtil,'../auth/application-authority.js':contract});
 const contextTypes=compile('apps/api/src/context/context.types.ts');
 const scopeModule=compile('apps/api/src/context/context-security-scope.service.ts',{'./context.types.js':contextTypes});
 const rolesModule=compile('apps/api/src/auth/roles.guard.ts',{'@capiro/shared':shared,'./roles.decorator.js':roles});
 const prospect=compile('apps/api/src/business-development/bizdev-meri-scope.service.ts',{}, {declarations:['MERI_PROSPECT_SCOPE_METADATA_KEY','UUID_RE','SCOPE_VERSION_RE','SCOPE_KEYS','MeriProspectScopeConflictError','parsePersistedMeriProspectScope']});
 const prospectHelper=compile('apps/api/src/meri/meri-prospect-scope.helpers.ts',{'../business-development/bizdev-meri-scope.service.js':prospect});
 const portfolioParser=compile('apps/api/src/research-portfolios/research-portfolio-meri-scope.service.ts',{}, {declarations:['MERI_RESEARCH_PORTFOLIO_SCOPE_METADATA_KEY','object','readMeriResearchPortfolioScope']});
 const portfolio=compile('apps/api/src/research-portfolios/research-portfolio-artifact-authority.ts',{}, {declarations:['validScope','authorizeResearchPortfolioConversation']},{...portfolioParser,loadAuthorizedResearchPortfolio(){throw Error('UNADMITTED_PORTFOLIO_FIXTURE');}});
 const serviceModule=compile('apps/api/src/meri/meri.service.ts',{}, {owner:'MeriService',methods:['applicationAuthorityIdentity','applicationAuthorityContext','ensureConversation','ensureClientVisible']},{...contract,...prospectHelper,...portfolio});
 const controllerModule=compile('apps/api/src/meri/meri.controller.ts',{}, {owner:'MeriController',methods:['applicationAuthorityIdentity','applicationAuthorityContext']},{Roles:roles.Roles,RolesGuard:rolesModule.RolesGuard});
 const clerk=new clerkModule.ClerkService({get(name){return name==='CLERK_SECRET_KEY'?'synthetic-fixture-secret':name==='CLERK_JWT_ISSUER'?'https://fixture.invalid':undefined;}}),store=new storeModule.TenantContextStore();
 const requestMiddleware=new middleware.TenantContextMiddleware(clerk,prisma,store),providerMiddleware=new middleware.TenantContextMiddleware(clerk,prisma,store);
 const service=Object.assign(new serviceModule.MeriService(),{prisma,applicationAuthorityTenant:providerMiddleware,applicationAuthorityScope:new scopeModule.ContextSecurityScopeService(prisma)});
 const controller=Object.assign(new controllerModule.MeriController(),{service}),guard=new rolesModule.RolesGuard({getAllAndOverride(key,targets){for(const t of targets){const value=metadata.get(t)?.[key];if(value!==undefined)return value;}}});
 const routes=new Map();for(const name of ['applicationAuthorityIdentity','applicationAuthorityContext']){const method=controller[name],m=metadata.get(method),prefix=metadata.get(controller.constructor)?.controller;if(m?.status!==200||prefix!=='clio'||m.headers['Cache-Control']!=='no-store')throw Error('PINNED_ROUTE_METADATA');routes.set('/api/'+prefix+'/'+m.path,{method,...m});}
 let requests=0;
 async function fetchImpl(url,init){
  requests++;const parsed=new URL(url),route=routes.get(parsed.pathname);if(parsed.origin!=='https://capiro-fixture.invalid'||!route||parsed.search||parsed.hash||init.method!=='POST')return new Response('',{status:404});
  if(init.signal?.aborted)throw Error('FIXTURE_CANCELLED');const headers={...init.headers},request={path:parsed.pathname,originalUrl:parsed.pathname,url:parsed.pathname,headers,hostname:'localhost',header(name){return this.headers[name.toLowerCase()];}},responseHeaders=new Headers();
  try{let pending;await requestMiddleware.use(request,{setHeader(k,v){responseHeaders.set(k,v);}},()=>{pending=store.run(request.tenantContext,async()=>{guard.canActivate({getHandler:()=>route.method,getClass:()=>controller.constructor,switchToHttp:()=>({getRequest:()=>request})});return route.method.call(controller,request.tenantContext,request,JSON.parse(init.body));});});
   if(!pending)throw Error('MIDDLEWARE_DID_NOT_DISPATCH');const result=await pending;if(init.signal?.aborted)throw Error('FIXTURE_CANCELLED');for(const [key,value] of Object.entries(route.headers))responseHeaders.set(key,value);return new Response(JSON.stringify(result),{status:route.status,headers:responseHeaders});
  }catch(error){responseHeaders.set('content-type','application/json');responseHeaders.set('cache-control','no-store');return new Response(JSON.stringify({error:'PINNED_ENDPOINT_REFUSED'}),{status:error instanceof HttpError?error.status:403,headers:responseHeaders});}
 }
 return Object.freeze({fetchImpl,sourceMetadata:source.metadata,stats:()=>({requests,separateMiddlewareProvider:true,nestBootstrap:false,externalPorts:'mocked'})});
}
