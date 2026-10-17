/**
 * Focused comparator test fixture for a sparse source checkout only.
 * The real ECS proof module cannot load here without its AWS SDK and omitted
 * storage dependency. Replace just its static measurement export when imported
 * by the offline provenance comparator; all other imports resolve normally.
 */
const comparator=new URL('../../../../../infra/product-preview/image-provenance.mjs',import.meta.url).href;
const proofSpecifier='../../apps/runtime/native-authority/ecs-prepared-task-proof.mjs';
const projection='export const productRunnerMeasurement=Object.freeze({contract:"meri.runner-entrypoint.v1",path:"apps/runtime/conversation-runner.mjs"});';

export async function resolve(specifier,context,nextResolve){
 if(context.parentURL===comparator&&specifier===proofSpecifier){
  return {url:'data:text/javascript,'+encodeURIComponent(projection),shortCircuit:true};
 }
 return nextResolve(specifier,context);
}
