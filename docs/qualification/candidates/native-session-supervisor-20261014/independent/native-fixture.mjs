// Independent local byte source, controlled by test IPC, no services or SDK.
process.on('message',message=>{
 if(message.kind==='bytes')process.stdout.write(Buffer.from(message.bytes,'base64'),()=>process.send({ack:true}));
 if(message.kind==='end')process.stdout.end(()=>process.send({ack:true}));
 if(message.kind==='exit')process.exit(0);
});
process.send({ready:true});
