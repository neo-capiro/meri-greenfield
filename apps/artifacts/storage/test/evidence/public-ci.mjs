/** Approved public registry dependency read; empty config and no ambient npm credentials. */
import {mkdir,copyFile,writeFile} from 'node:fs/promises';import {spawn} from 'node:child_process';
const root=process.argv[2]??'/tmp/meri-storage-public-ci-20261013';await mkdir(root,{recursive:false});
for(const file of ['package.json','package-lock.json'])await copyFile('apps/artifacts/storage/'+file,root+'/'+file);
for(const file of ['user.npmrc','global.npmrc'])await writeFile(root+'/'+file,'',{flag:'wx',mode:0o600});
const environment={PATH:process.env.PATH};
// Preserve only the network permission's transport routing, not npm/user secrets.
for(const key of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','NO_PROXY','no_proxy']){const value=process.env[key];if(value===undefined)continue;
 if(!key.toLowerCase().startsWith('no_')){const url=new URL(value);if(url.username||url.password)throw Error('Credential-bearing proxy refused');}environment[key]=value;}
// Keep the tool's CA trust paths; TLS verification remains enabled.
for(const key of ['NODE_EXTRA_CA_CERTS','SSL_CERT_FILE'])if(process.env[key]!==undefined)environment[key]=process.env[key];
const child=spawn('npm',['ci','--ignore-scripts','--no-audit','--no-fund','--update-notifier=false','--fetch-retries=0','--fetch-timeout=60000','--registry=https://registry.npmjs.org','--userconfig='+root+'/user.npmrc','--globalconfig='+root+'/global.npmrc','--cache='+root+'/cache'],{cwd:root,env:environment,stdio:'inherit'});
child.on('exit',code=>process.exitCode=code??1);
