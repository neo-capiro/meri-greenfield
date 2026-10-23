"""Write a one-off clone-only Workspace task definition (registration is a separate CLI call).
argv[1] = migrate | diff; argv[2] = digest-pinned image (default: the serving preview Workspace image).
diff runs `prisma migrate diff` from the clone to the image's schema (introspection only) and prints ws_ DDL."""
import json, subprocess, sys
AWS = ['aws', '--profile', 'capiro-dev', '--region', 'us-east-1', '--output', 'json']
CLONE = 'capiro-newstack-preview-clone.cluster-csryw28ai752.us-east-1.rds.amazonaws.com'
MASTER = 'arn:aws:secretsmanager:us-east-1:967807252336:secret:/capiro/dev/aurora/master-P4z1Vo'
serving = json.loads(subprocess.run(AWS + ['ecs', 'describe-task-definition', '--task-definition', 'capiro-preview-workspace'],
                                    check=True, capture_output=True, text=True).stdout)['taskDefinition']
(c,) = serving['containerDefinitions']
DIFF = r'''cd /app/apps/workspace
P=$(node -e "process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))")
node node_modules/prisma/build/index.js migrate diff --from-url "postgresql://$DB_USER:$P@$DB_HOST:$DB_PORT/$DB_NAME?schema=public&sslmode=require" --to-schema-datamodel prisma/schema.prisma --script > /tmp/d.sql
echo "diff exit $? lines $(grep -c . /tmp/d.sql)"
grep -v -i -E '^(DROP TABLE|-- DropTable|DROP TYPE|-- DropEnum)' /tmp/d.sql | grep -i -B2 -A3 'ws_' | head -150'''
mode = sys.argv[1]
assert mode in ('migrate', 'diff'), mode
image = sys.argv[2] if len(sys.argv) > 2 else c['image']
assert '@sha256:' in image, image
td = {
  'family': f'capiro-preview-workspace-clone-{mode}',
  'executionRoleArn': serving['executionRoleArn'],
  'networkMode': 'awsvpc', 'requiresCompatibilities': ['FARGATE'], 'cpu': '512', 'memory': '1024',
  'runtimePlatform': serving['runtimePlatform'],
  'containerDefinitions': [{
    'name': 'workspace', 'image': image, 'essential': True, **({'command': ['migrate']} if mode == 'migrate' else {
      'entryPoint': ['/bin/sh', '-c'],
      'command': [DIFF],
    }),
    'environment': [{'name': 'DB_HOST', 'value': CLONE}, {'name': 'DB_NAME', 'value': 'capiro'}],
    'secrets': [{'name': n, 'valueFrom': f'{MASTER}:{k}::'} for n, k in
                (('DB_PORT', 'port'), ('DB_USER', 'username'), ('DB_PASSWORD', 'password'))],
    'logConfiguration': {'logDriver': 'awslogs', 'options': {'awslogs-group': '/capiro/dev/api', 'awslogs-region': 'us-east-1',
                         'awslogs-stream-prefix': f'preview-workspace-clone-{mode}'}},
  }],
}
json.dump(td, open(f'ws-{mode}-td.json', 'w'), indent=1)
print('image', image.split('@')[1][:19], 'host', CLONE)
