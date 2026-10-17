/** Read-only, offline size/hash check of a separately reviewed revision-2 request. */
import {readFileSync} from 'node:fs';
import {createProductImageBuildRecipe} from '../../../../../infra/product-preview/image-build-recipe.mjs';

try{
 if(process.argv.length!==3)throw Error();
 const raw=readFileSync(process.argv[2]);
 if(raw.length<1||raw.length>16384)throw Error();
 const pin=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 const result=createProductImageBuildRecipe(pin);
 console.log(JSON.stringify({status:'OFFLINE_SIZE_ONLY',buildspecBytes:Buffer.byteLength(result.buildspecJson),limitBytes:25600,buildspecSha256:result.buildspecSha256,requestSha256:result.requestSha256}));
}catch{
 console.error('PRODUCT_IMAGE_OFFLINE_CHECK_REFUSED');
 process.exitCode=2;
}
