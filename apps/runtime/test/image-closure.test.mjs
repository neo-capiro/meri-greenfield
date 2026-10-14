/** Real Docker COPY filter plus locked dependency layout; no task/server/model start. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, cpSync, mkdirSync, rmSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import ts from '../node_modules/typescript/lib/typescript.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), roles = ['apps/runtime/cli.mjs', 'apps/runtime/control.mjs', 'apps/runtime/temporal-worker.mjs', 'apps/runtime/conversation-runner.mjs'];
function closure() { const seen = new Set(), dynamic = new Set(), queue = [...roles]; while (queue.length) {
    const path = queue.shift();
    if (seen.has(path))
        continue;
    assert.ok(existsSync(join(root, path)), path);
    seen.add(path);
    if (!/\.(?:mjs|js|ts)$/u.test(path))
        continue;
    const ast = ts.createSourceFile(path, readFileSync(join(root, path), 'utf8'), ts.ScriptTarget.Latest, true);
    const add = (text, isDynamic = false) => { if (!text?.startsWith('.'))
        return; const next = relative(root, resolve(root, dirname(path), text)); assert.ok(!next.startsWith('../'), next); if (existsSync(join(root, next))) {
        queue.push(next);
        if (isDynamic)
            dynamic.add(next);
    }
    else
        assert.fail('Missing source dependency ' + path + ' -> ' + next); };
    const strings = node => { if (ts.isStringLiteralLike(node))
        return [node.text]; if (ts.isConditionalExpression(node))
        return [...strings(node.whenTrue), ...strings(node.whenFalse)]; return []; };
    const visit = node => { if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly || ts.isExportDeclaration(node) && !node.isTypeOnly) && node.moduleSpecifier)
        add(node.moduleSpecifier.text); if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        for (const value of strings(node.arguments[0]))
            add(value, true); if (ts.isNewExpression(node) && node.expression.getText(ast) === 'URL' && node.arguments?.[1]?.getText(ast) === 'import.meta.url')
        for (const value of strings(node.arguments[0]))
            add(value); ts.forEachChild(node, visit); };
    visit(ast);
} const assets = JSON.parse(readFileSync(join(root, 'packages/skills/assets.json'), 'utf8')); for (const asset of assets.assets)
    for (const field of ['manifestPath', 'prosePath'])
        seen.add(relative(root, resolve(root, 'packages/skills', asset[field]))); return { files: [...seen].sort(), dynamic: [...dynamic].filter(path => /\.(mjs|js)$/u.test(path)).sort() }; }
test('actual Docker-filtered COPY contains every role dependency and all three roles import with no workspace fallback', () => {
    const temp = mkdtempSync(join(tmpdir(), 'meri-image-closure-')), tag = 'meri-local-copy-closure:' + process.pid + '-' + Date.now(), name = 'meri-local-copy-closure-' + process.pid + '-' + Date.now();
    const run = (command, args, options = {}) => execFileSync(command, command === 'docker' ? ['--config', join(temp, 'docker-client'), ...args] : args, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, ...options });
    try {
        const docker = readFileSync(join(root, 'apps/runtime/Dockerfile'), 'utf8'), copies = docker.split('\n').filter(line => /^COPY (?:apps|packages) /u.test(line));
        assert.deepEqual(copies, ['COPY apps ./apps', 'COPY packages ./packages']);
        const rootCopy = docker.split('\n').find(line => line === 'COPY package.json package-lock.json ./');
        assert.ok(rootCopy);
        const file = join(temp, 'Dockerfile');
        writeFileSync(file, 'FROM scratch\n' + rootCopy + '\n' + copies.join('\n') + '\n');
        run('docker', ['build', '--network', 'none', '--progress', 'plain', '-t', tag, '-f', file, root]);
        run('docker', ['create', '--network', 'none', '--name', name, tag, '/never-executed']);
        const tar = join(temp, 'copy.tar');
        run('docker', ['export', '-o', tar, name]);
        const tree = join(temp, 'tree');
        mkdirSync(tree);
        run('tar', ['-xf', tar, '-C', tree]);
        const graph = closure(), missing = graph.files.filter(path => !existsSync(join(tree, path)));
        console.log(JSON.stringify({ phase: 'actual-docker-copy', roles, files: graph.files.length, missing }));
        assert.deepEqual(missing, [], 'Production closure excluded by actual .dockerignore');
        // Reproduce every exact Docker npm-ci prefix. Context node_modules are ignored,
        // just as Docker installs these dependencies before COPY; no workspace fallback.
        const prefixes = [...docker.matchAll(/RUN npm ci(?: --prefix (\S+))?/gu)].map(match => match[1] ?? '.');
        for (const prefix of prefixes) {
            const src = join(root, prefix, 'node_modules');
            assert.ok(existsSync(src), 'Run locked npm ci for Docker prefix ' + prefix);
            cpSync(src, join(tree, prefix, 'node_modules'), { recursive: true, verbatimSymlinks: true });
        }
        const aliases = docker.split('\n').filter(line => line.startsWith('RUN mkdir -p node_modules/'));
        assert.equal(aliases.length, 1);
        run('bash', ['-c', aliases[0].slice(4)], { cwd: tree });
        const contained = path => { for (const entry of readdirSync(path, { withFileTypes: true })) {
            const next = join(path, entry.name), stat = lstatSync(next);
            if (stat.isSymbolicLink()) {
                const actual = realpathSync(next);
                assert.ok(actual === tree || actual.startsWith(tree + '/'), 'Dependency/source symlink escapes image tree: ' + next);
            }
            else if (stat.isDirectory())
                contained(next);
        } };
        contained(tree);
        const smoke = join(temp, 'smoke.mjs');
        writeFileSync(smoke, `import {pathToFileURL} from 'node:url';import http from 'node:http';import https from 'node:https';import net from 'node:net';import tls from 'node:tls';let attempts=0;const denied=()=>{attempts++;throw Error('IMPORT_NETWORK_SIDE_EFFECT');};globalThis.fetch=denied;http.request=denied;https.request=denied;net.connect=denied;net.createConnection=denied;tls.connect=denied;net.Server.prototype.listen=denied;const tree=${JSON.stringify(tree)},paths=${JSON.stringify([...new Set([...roles, ...graph.dynamic])])};for(const path of paths)await import(pathToFileURL(tree+'/'+path));console.log(JSON.stringify({phase:'isolated-role-imports',roles:paths,networkAttempts:attempts,modelTurns:0}));if(attempts!==0)throw Error('IMPORT_NETWORK_ATTEMPT');if(process.env.MERI_IMAGE_CHECK_WORKFLOW_BUNDLE==='1'){const {bundleWorkflowCode}=await import(pathToFileURL(tree+'/apps/runtime/node_modules/@temporalio/worker/lib/index.js'));const {workerOptions}=await import(pathToFileURL(tree+'/apps/runtime/temporal-worker.mjs'));const options=workerOptions({configuration:{temporal:{namespace:'synthetic',taskQueue:'synthetic'},limits:{shutdownMs:1000}},connection:{},native:{}});const bundle=await bundleWorkflowCode({workflowsPath:options.workflowsPath});if(!bundle.code.includes('meriConversationLifecycleWorkflow'))throw Error('WORKFLOW_EXPORT_MISSING');console.log(JSON.stringify({phase:'workflow-bundle',workflowBundled:true,networkAttempts:attempts}));if(attempts!==0)throw Error('BUNDLE_NETWORK_ATTEMPT');}`);
        const result = spawnSync(process.execPath, [smoke], { cwd: tree, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { PATH: process.env.PATH, TMPDIR: temp, MERI_IMAGE_CHECK_WORKFLOW_BUNDLE: process.env.MERI_IMAGE_CHECK_WORKFLOW_BUNDLE ?? '0' } });
        console.log(result.stdout);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.signal, null);
        const help = spawnSync(process.execPath, [join(tree, 'apps/runtime/cli.mjs'), '--help'], { cwd: tree, encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH, TMPDIR: temp } });
        assert.equal(help.status, 0, help.stderr);
        assert.match(help.stdout, /control\|temporal-worker\|conversation-runner/u);
        console.log(JSON.stringify({ phase: 'cli-help', status: help.status }));
    }
    finally {
        const errors = [];
        for (const [kind, target] of [['container', name], ['image', tag]]) {
            try {
                const inspect = () => spawnSync('docker', ['--config', join(temp, 'docker-client'), kind, 'inspect', target], { encoding: 'utf8', timeout: 10000 });
                const before = inspect();
                if (before.status === 0)
                    run('docker', kind === 'container' ? ['rm', target] : ['image', 'rm', target]);
                else
                    assert.ok(before.status === 1 && /no such/i.test(before.stderr), before.stderr);
                const after = inspect();
                assert.ok(after.status === 1 && /no such/i.test(after.stderr), after.stderr);
                console.log(JSON.stringify({ phase: 'cleanup', kind, target, absent: true }));
            }
            catch (error) {
                errors.push(error);
            }
        }
        try {
            rmSync(temp, { recursive: true, force: true });
            assert.equal(existsSync(temp), false);
        }
        catch (error) {
            errors.push(error);
        }
        if (errors.length)
            throw new AggregateError(errors, 'COPY_FIXTURE_CLEANUP_UNKNOWN');
    }
});
