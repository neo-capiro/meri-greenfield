const port=chrome.runtime.connect({name:'selected-tab-popup'}),element=id=>document.getElementById(id);
for(const action of ['approve','capture','pause','revoke','share'])element(action).addEventListener('click',()=>{
 element('error').textContent='';port.postMessage({action});
});
port.onMessage.addListener(message=>{
 if(message.type==='error'){element('error').textContent=message.message;return;}
 if(message.type!=='view')return;const v=message.view;
 const outcome=v.outcome==='unknown'?'Share sent. Check its upload status in Capiro.':v.outcome==='stored'?'Attachment stored in Capiro.':v.outcome==='refused'?'Capiro refused the attachment.':'';
 element('status').textContent=`Connection: ${v.state}. ${v.busy?'Reading the selected tab…':outcome}`;
 element('destination').textContent=v.labels?`${v.labels.account} · ${v.labels.conversation} (${v.origin})`:'';
 element('help').hidden=!!v.labels;
 element('approve').hidden=!['connected','paused'].includes(v.state);
 element('approve').textContent=v.state==='paused'?'Resume this chat':'Allow this chat';
 element('capture').hidden=v.state!=='active';element('capture').disabled=v.busy||v.outcome==='unknown';
 element('pause').hidden=v.state!=='active';element('revoke').hidden=!v.labels;
 element('preview').hidden=!v.selection;
 element('title').textContent=v.selection?.title??'';element('url').textContent=v.selection?.url??'';
 element('text').textContent=v.selection?.text??'';element('share').disabled=v.busy;
});
port.onDisconnect.addListener(()=>{
 element('status').textContent='Disconnected. Reconnect from Capiro.';element('text').textContent='';element('preview').hidden=true;
 for(const action of ['approve','capture','pause','revoke','share'])element(action).disabled=true;
});
