import json,subprocess,sys,time,base64
AWS=['aws','--profile','capiro-dev','--region','us-east-1']
js=open(sys.argv[1],encoding='utf-8').read(); tag=sys.argv[2]
b64=base64.b64encode(js.encode()).decode()
cmd=f"cd /app/apps/api && echo {b64} | base64 -d > /tmp/q.cjs && node /tmp/q.cjs"
ov={"containerOverrides":[{"name":"core","command":[cmd]}]}
net={"awsvpcConfiguration":{"subnets":["subnet-0e38bd390f8961fef","subnet-0920665f91c905f01","subnet-06db79cd21239de19"],"securityGroups":["sg-01def4e5c0fe44d4a"],"assignPublicIp":"DISABLED"}}
r=json.loads(subprocess.run(AWS+['ecs','run-task','--cluster','capiro-dev','--launch-type','FARGATE','--task-definition','capiro-preview-core-clone-readonly:1','--network-configuration',json.dumps(net),'--overrides',json.dumps(ov),'--started-by','fable-'+tag,'--output','json'],capture_output=True,text=True,check=True).stdout)
arn=r['tasks'][0]['taskArn']; tid=arn.split('/')[-1]
subprocess.run(AWS+['ecs','wait','tasks-stopped','--cluster','capiro-dev','--tasks',arn],check=False)
d=json.loads(subprocess.run(AWS+['ecs','describe-tasks','--cluster','capiro-dev','--tasks',arn,'--output','json'],capture_output=True,text=True).stdout)['tasks'][0]
print('exit',d['containers'][0].get('exitCode'),d.get('stoppedReason'))
ev=json.loads(subprocess.run(AWS+['logs','get-log-events','--log-group-name','/capiro/preview-first-chat/core','--log-stream-name',f'core/core/{tid}','--output','json'],capture_output=True,text=True).stdout)['events']
for e in ev: print(e['message'][:20000])
