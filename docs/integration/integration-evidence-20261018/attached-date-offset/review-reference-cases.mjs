import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
assert.equal(process.env.NODE_TEST_CONTEXT,undefined);
const values=[
 '12:30 Jan 1 2020+0530','12:30 Jan 1 2020-0530','12:30 Jan 1 2020+05:30','12:30 Jan 1 2020-05:30',
 '12:30 Jan 1 2020+5','12:30 Jan 1 2020-5','12:30 Jan 1 2020+5:3','12:30 Jan 1 2020-5:3',
 '12:30 Jan 1 2020+5:','12:30 Jan 1 2020-5:','12:30 Jan 1 2020+0000','12:30 Jan 1 2020-0000',
 '12:30 Jan 1 2020+0530 (PST)','12:30 Jan 1 2020(foo)+0530','12:30 Jan 1 2020+0530(foo)',
 '12:30 Jan1 2020+0530','12:30 1Jan2020+0530','12:30 2020-01-01+0530','12:30 01/01/2020+0530',
 '12:30 Jan 1 2020++0530','12:30 Jan 1 2020+-0530','12:30 Jan 1 2020--0530',
 '12:30 Jan 1 2020','12:30 Jan-1-2020','12:30 2020-01-01','12:30 2020-1-1','12:30 01-01-2020',
 '12:30 Jan-1-20','12:30 Jan-1-0020','12:30 Jan-1-2020(foo)','12:30 Jan-1-2020 (PST)',
 '12:30 Jan;-1 2020','12:30 Jan 1 2020 -0530','12:30 Jan 1 2020 +0530',
 'Jan 1 2020+0530 12:30','Jan 1 2020-0530 12:30','12:30 Jan 1+0530 2020','12:30 Jan 1-0530 2020',
 '12:30 Jan 1 2020-01','12:30 Jan 1 2020-1','12:30 Jan 1 2020-99','12:30 Jan 1 2020-100',
];
const cases=values.map(value=>{const at=Date.parse(value);return {value,expected:Number.isFinite(at)?new Date(at).toISOString():null};});
console.log(JSON.stringify({node:process.version,TZ:process.env.TZ,cases},null,2));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(cases,null,2)+'\n');
