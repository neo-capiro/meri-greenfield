import {envelope,context,validateShape} from './fixture.mjs';
const c=context(),e=envelope();validateShape('RunBinding',c.binding);validateShape('Scope',c.scopes[0]);
console.log(JSON.stringify({canonicalFixtureAdmitted:true,operation:e.operation.id,classification:'recommendations',runtimeAccepted:false}));
