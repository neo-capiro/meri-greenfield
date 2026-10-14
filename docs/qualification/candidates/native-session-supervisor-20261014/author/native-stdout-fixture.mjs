// Task-owned zero-service native-format stdout fixture. IPC is test control only.
let sequence=0;
process.on('message',message=>{
 if(message?.kind==='bytes'){const bytes=Buffer.from(message.base64,'base64');process.stdout.write(bytes,()=>process.send?.({sequence:++sequence}));}
 else if(message?.kind==='exit')process.stdout.end(()=>process.exit(0));
});
process.send?.({ready:true});
