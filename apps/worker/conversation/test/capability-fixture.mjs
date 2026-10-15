/** Real, canonical temporary directories for capability tests: a materialized original skill plugin (the trusted
 * prepared copy) and a scratch root for alias/symlink cases. Removed when the test process exits. */
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {materializeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
export const scratch=realpathSync(mkdtempSync(join(tmpdir(),'meri-capability-')));
process.once('exit',()=>rmSync(scratch,{recursive:true,force:true}));
export const plugin=join(scratch,'skill-plugin');
await materializeSkillPlugin({directory:plugin});
