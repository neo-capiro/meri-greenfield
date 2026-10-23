// Review probe v2: the REAL control-credential classifier from this tree's tenant-context.middleware.ts (transpiled with the
// repo's TypeScript), evaluated inside a consumer-mounted Nest 10 middleware under the production global prefix and exclude list.
require('reflect-metadata');
const fs = require('node:fs'), net = require('node:net');
const ts = require('typescript');
const { Module, Controller, Post, HttpCode, Injectable, RequestMethod } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const src = fs.readFileSync('src/tenant/tenant-context.middleware.ts', 'utf8');
const grab = (re, name) => { const m = src.match(re); if (!m) throw new Error('missing ' + name); return m[0]; };
const pieces = [
  grab(/const MERI_CONTROL_POST_PATHS = new Set\(\[[\s\S]*?\]\);/, 'MERI_CONTROL_POST_PATHS'),
  ((src.match(/function mountedRequestPath\(req: Request\): string \{[\s\S]*?\n\}/) ||
    (fs.existsSync('src/auth/mounted-request-path.ts') && fs.readFileSync('src/auth/mounted-request-path.ts', 'utf8').match(/function mountedRequestPath\(req: Request\): string \{[\s\S]*?\n\}/)) || [''])[0]),
  grab(/function isMeriControlAuthorityPost\(req: Request\): boolean \{[\s\S]*?\n\}/, 'isMeriControlAuthorityPost'),
].join('\n');
const js = ts.transpileModule(pieces + '\nmodule.exports = { isMeriControlAuthorityPost, MERI_CONTROL_POST_PATHS };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} }; new Function('module', 'exports', js)(mod, mod.exports);
const { isMeriControlAuthorityPost, MERI_CONTROL_POST_PATHS } = mod.exports;
const hasHelper = /function mountedRequestPath/.test(src) ? 'middleware-local' : (fs.existsSync('src/auth/mounted-request-path.ts') ? 'shared auth/mounted-request-path.ts' : 'none');
class C { h() { return { ok: true }; } }
for (const m of ['identity', 'context', 'membership', 'current', 'artifact']) {
  C.prototype[m] = C.prototype.h;
  const d = Object.getOwnPropertyDescriptor(C.prototype, m);
  Post(m)(C.prototype, m, d); HttpCode(200)(C.prototype, m, d);
}
Controller('clio/application-authority')(C);
let seen = null;
class Mw { use(req, _res, next) { seen = { path: req.path, baseUrl: req.baseUrl, originalUrl: req.originalUrl, admits: isMeriControlAuthorityPost(req) }; next(); } }
Injectable()(Mw);
const A = RequestMethod.ALL, G = RequestMethod.GET, P = RequestMethod.POST;
class AppModule {
  configure(consumer) {
    consumer.apply(Mw).exclude(
      { path: 'health', method: A }, { path: 'webhooks/(.*)', method: A },
      { path: '/api/v1/demo-requests', method: P }, { path: 'api/v1/demo-requests', method: P },
      { path: '/api/engagement/integrations/microsoft/callback', method: G }, { path: 'api/engagement/integrations/microsoft/callback', method: G },
      { path: '/api/engagement/integrations/microsoft/notifications', method: A }, { path: 'api/engagement/integrations/microsoft/notifications', method: A },
      { path: '/api/engagement/integrations/google/callback', method: G }, { path: 'api/engagement/integrations/google/callback', method: G },
      { path: '/api/clio/runtime/(.*)', method: A }, { path: 'api/clio/runtime/(.*)', method: A },
      { path: '/api/clio/mcp-oauth/callback', method: G }, { path: 'api/clio/mcp-oauth/callback', method: G },
      { path: '/api/insights', method: G }, { path: 'api/insights', method: G },
      { path: 'api/engagement/newsletter-public/(.*)', method: A }, { path: '/api/engagement/newsletter-public/(.*)', method: A },
      { path: '/api/internal/(.*)', method: A }, { path: 'api/internal/(.*)', method: A },
    ).forRoutes('*');
  }
}
Module({ controllers: [C] })(AppModule);
function raw(port, line) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(`${line}\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`));
    let buf = ''; s.on('data', (d) => { buf += d; }); s.on('end', () => resolve(buf.split('\r\n')[0])); s.on('error', () => resolve('error'));
  });
}
(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api', { exclude: [{ path: 'health', method: A }, { path: 'webhooks/(.*)', method: A }] });
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  const base = '/api/clio/application-authority/';
  const cases = [
    ['identity', `POST ${base}identity HTTP/1.1`, true], ['context', `POST ${base}context HTTP/1.1`, true],
    ['membership', `POST ${base}membership HTTP/1.1`, true], ['current', `POST ${base}current HTTP/1.1`, true],
    ['fifth path (artifact)', `POST ${base}artifact HTTP/1.1`, false],
    ['trailing slash', `POST ${base}identity/ HTTP/1.1`, false],
    ['absolute-form', `POST http://127.0.0.1:${port}${base}identity HTTP/1.1`, false],
    ['query string', `POST ${base}identity?x=1 HTTP/1.1`, null],
    ['GET', `GET ${base}identity HTTP/1.1`, false],
  ];
  const out = [];
  for (const [name, line, expected] of cases) {
    seen = null; const status = await raw(port, line);
    out.push({ case: name, status, admits: seen ? seen.admits : '(middleware not reached)', expected, ok: expected === null || (seen ? seen.admits : false) === expected, saw: seen });
  }
  console.log(JSON.stringify({ hasMountedRequestPathHelper: hasHelper, allowlist: [...MERI_CONTROL_POST_PATHS],
    nestCore: require('@nestjs/core/package.json').version, express: require('express/package.json').version,
    allOk: out.every((r) => r.ok), out }, null, 1));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
