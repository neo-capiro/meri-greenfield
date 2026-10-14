import {readFile} from 'node:fs/promises';
const target=new URL('../../../../../packages/contracts/retrieval-0.2/validate.mjs',import.meta.url).href;
export async function load(url,context,next){
 if(url===target)return {format:'module',source:await readFile(new URL('./validator-baseline.mjs.txt',import.meta.url),'utf8'),shortCircuit:true};
 return next(url,context);
}
