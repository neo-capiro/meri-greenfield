// Fixed reviewer-owned source fixture. It accepts no user program or filesystem path.
const scenario=process.argv[2];
if(scenario==='normal'){process.stdout.write('out');process.stderr.write('err');}
else if(scenario==='stdout'){process.stdout.write(Buffer.alloc(65536,65));}
else if(scenario==='stderr'){process.stderr.write(Buffer.alloc(131072,66));}
else if(scenario==='failure'){process.stderr.write('failure');process.exitCode=3;}
else if(scenario==='deadline'){setInterval(()=>{},1000);}
else throw Error('Unknown fixed fixture scenario');
