/** Experiment data and native SDK plugin packaging only. No product admission logic. */
import {readFile, mkdir, writeFile, copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';

export const projectKey = 'meri-item0-synthetic';
export const questions = JSON.parse(await readFile(new URL('./fixtures/questions.json', import.meta.url), 'utf8'));
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function prepareFixture(directory) {
  await mkdir(directory, {recursive: true});
  await copyFile(new URL('./fixtures/fixture-records.txt', import.meta.url), join(directory, 'fixture-records.txt'));
  const plugin = join(directory, 'plugin');
  await mkdir(join(plugin, '.claude-plugin'), {recursive: true});
  await writeFile(join(plugin, '.claude-plugin/plugin.json'), JSON.stringify({name: 'meri-original-skills', version: '1.0.0'}));
  const assets = JSON.parse(await readFile(new URL('../../packages/skills/assets.json', import.meta.url), 'utf8'));
  const skills = [];
  for (const asset of assets.assets) {
    const bytes = await readFile(new URL(asset.prosePath, new URL('../../packages/skills/', import.meta.url)));
    const name = /^name:\s*([a-z0-9-]+)\s*$/m.exec(bytes.toString())?.[1];
    if (!name) continue; // Same original asset omission as the canonical plugin: no native frontmatter.
    if (skills.some(skill => skill.name === name)) throw Error('DUPLICATE_NATIVE_SKILL');
    const path = join(plugin, 'skills', name);
    await mkdir(path, {recursive: true});
    await writeFile(join(path, 'SKILL.md'), bytes);
    skills.push({name, skillId: asset.skillId, version: asset.skillVersion,
      sha256: sha256(bytes), canonicalSha256: asset.proseSha256,
      modelInvocationDisabled: /disable-model-invocation:\s*true/.test(bytes.toString())});
  }
  return {plugin, skills};
}

/** Loopback HTTP MCP exercises SDK's real HTTP transport. This header is synthetic, not an auth protocol. */
export async function startFixtureMcp() {
  const requests = [], toolCalls = [];
  const transports = new Set();
  const text = await readFile(new URL('./fixtures/fixture-records.txt', import.meta.url), 'utf8');
  const server = createServer(async (request, response) => {
    requests.push({method: request.method, authorized: request.headers.authorization === 'Bearer synthetic-spike-only'});
    if (request.url !== '/mcp' || request.headers.authorization !== 'Bearer synthetic-spike-only') {
      response.writeHead(401).end(); return;
    }
    if (request.method !== 'POST') { response.writeHead(405).end(); return; }
    const mcp = new McpServer({name: 'synthetic-fixture', version: '1.0.0'});
    mcp.registerTool('fixture_records', {description: 'Read the complete SYNTHETIC rehearsal fixture; never real Capiro data.',
      inputSchema: {client: z.enum(['Atlas', 'Beacon', 'both'])}}, async ({client}) => {
      toolCalls.push({client});
      return {content: [{type: 'text', text}]};
    });
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined});
    transports.add(transport);
    response.on('close', () => { transports.delete(transport); void mcp.close(); });
    try { await mcp.connect(transport); await transport.handleRequest(request, response); }
    catch { if (!response.headersSent) response.writeHead(500).end(); else response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(undefined)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('LOOPBACK_ADDRESS_UNAVAILABLE');
  return {requests, toolCalls, config: {type: 'http', url: `http://127.0.0.1:${address.port}/mcp`,
    headers: {Authorization: 'Bearer synthetic-spike-only'}, timeout: 10000, alwaysLoad: true},
    async close() { for (const transport of transports) await transport.close(); server.closeAllConnections();
      await new Promise(resolve => server.close(resolve)); }};
}
