/** Source-test-only fixed interpreter: actual Python bridge/Grants, scripted SQL persisted to a private file. */
import {mkdtemp,writeFile,chmod,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
export async function createScriptedLifecycleInterpreter(){
 const directory=await mkdtemp(join(tmpdir(),'meri-lifecycle-test-')),sqlStatePath=join(directory,'sql.json'),pythonExecutable=join(directory,'python-fixture');
 const root=fileURLToPath(new URL('../../../',import.meta.url));
 const text=`#!/usr/bin/python3\nimport sys\nsys.path.insert(0,${JSON.stringify(root)})\nfrom apps.proxy.qualification.assembly.test_lifecycle import scripted_process\nraise SystemExit(scripted_process(${JSON.stringify(sqlStatePath)}))\n`;
 await writeFile(pythonExecutable,text);await chmod(pythonExecutable,0o700);
 return Object.freeze({evidenceKind:'scripted-sql',pythonExecutable,sqlStatePath,
  async readState(){return JSON.parse(await readFile(sqlStatePath,'utf8'));},
  async close(){await rm(directory,{recursive:true,force:true});}
 });
}
