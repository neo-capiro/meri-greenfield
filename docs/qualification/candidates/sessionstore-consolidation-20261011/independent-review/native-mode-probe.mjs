import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { captureNativeSessionFiles } from '../../../../../apps/worker/qualification/checkpoint/native-session-files.mjs';
const sessionId = '5be61438-0098-4239-bdb1-01b32604209e';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meri-independent-mode-'));
const borrowed = path.join(root, 'borrowed');
const configDir = path.join(borrowed, 'config');
const projectKey = '-workspace-conversation';
const project = path.join(configDir, 'projects', projectKey);
fs.mkdirSync(project, {recursive: true});
fs.writeFileSync(path.join(project, `${sessionId}.jsonl`), 'opaque unchanged transcript\n');
const original = fs.readSync;
let mutationRan = false;
try {
 fs.readSync = (...args) => {const count = original(...args); if (!mutationRan) {mutationRan = true; fs.chmodSync(borrowed, 0o700);} return count;};
 syncBuiltinESMExports();
 assert.throws(() => captureNativeSessionFiles({sessionId, cwd: '/workspace/conversation', projectKey, configDir}), {code: 'SOURCE_CHANGED'});
 assert.equal(mutationRan, true);
} finally {fs.readSync = original; syncBuiltinESMExports(); fs.rmSync(root, {recursive: true, force: true});}
assert.equal(fs.existsSync(root), false);
console.log(JSON.stringify({borrowedParentModeChange: 'REFUSED_SOURCE_CHANGED', mutationRan, ownedRootRemoved: true}));
