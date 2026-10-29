/** Copy the generated public receiver verbatim into this unpacked extension's
 * source tree. No compilation, application build or browser installation. */
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../../../packages/contracts/dist/selected-tab-application.mjs',import.meta.url));
const destination=new URL('contract.mjs',import.meta.url);
if(process.argv.includes('--check')){
 if(!source.equals(await readFile(destination)))throw Error('Extension contract differs from canonical public receiver');
}else await writeFile(destination,source);
