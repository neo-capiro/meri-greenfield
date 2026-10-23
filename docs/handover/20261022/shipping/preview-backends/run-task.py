"""Run one task-definition revision once on capiro-dev (Core networking), wait, print exit code and its log stream.
Usage: python run-task.py <family:revision> <container> <log-stream-prefix>"""
import json, subprocess, sys
AWS = ['aws', '--profile', 'capiro-dev', '--region', 'us-east-1', '--output', 'json']
td, container, prefix = sys.argv[1:4]
net = {'awsvpcConfiguration': {'subnets': ['subnet-0e38bd390f8961fef', 'subnet-0920665f91c905f01', 'subnet-06db79cd21239de19'],
                               'securityGroups': ['sg-01def4e5c0fe44d4a'], 'assignPublicIp': 'DISABLED'}}
run = lambda *a: json.loads(subprocess.run(AWS + list(a), check=True, capture_output=True, text=True).stdout or '{}')
arn = run('ecs', 'run-task', '--cluster', 'capiro-dev', '--launch-type', 'FARGATE', '--task-definition', td,
          '--network-configuration', json.dumps(net), '--started-by', 'fable-preview-backends')['tasks'][0]['taskArn']
print('task', arn.split('/')[-1])
subprocess.run(AWS + ['ecs', 'wait', 'tasks-stopped', '--cluster', 'capiro-dev', '--tasks', arn], check=False)
t = run('ecs', 'describe-tasks', '--cluster', 'capiro-dev', '--tasks', arn)['tasks'][0]
print('exit', t['containers'][0].get('exitCode'), t.get('stoppedReason'))
events = run('logs', 'get-log-events', '--log-group-name', '/capiro/dev/api',
             '--log-stream-name', f"{prefix}/{container}/{arn.split('/')[-1]}", '--start-from-head')['events']
for e in events: print(e['message'][:2000])
