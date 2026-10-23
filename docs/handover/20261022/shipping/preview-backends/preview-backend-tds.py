"""Register capiro-preview-<svc> task definitions from the live capiro-dev-<svc> ones (registration only; no service).
Changes vs live: image -> preview ECR digest (ca4de503), DB_HOST secret -> plain env (new-stack clone),
RELEASE_SHA, background schedulers/senders off, own log stream prefix. Everything else identical."""
import json, subprocess, sys
AWS = ['aws', '--profile', 'capiro-dev', '--region', 'us-east-1']
CLONE = 'capiro-newstack-preview-clone.cluster-csryw28ai752.us-east-1.rds.amazonaws.com'
SHA = 'ca4de503fb6ec09caf0daf8b976a0f649c6b9665'
OFF = {  # background jobs: no duplicate scheduled sends/monitors from a second stack
 'intel-api': ['LEGIWATCH_INTERNAL_WORKFLOWS_ENABLED','LEGIWATCH_KEYWORD_AUTO_ADD_ENABLED','LEGIWATCH_RECORD_RECONCILIATION_ENABLED',
   'LEGIWATCH_KEYWORD_DELIVERY_ENABLED','LEGIWATCH_KEYWORD_DISCOVERY_ENABLED','HEARING_PUBLIC_AUDIO_CAPTURE_ALL_ENABLED',
   'HEARING_AUDIO_MAINTENANCE_ENABLED','LEGIWATCH_HEARING_SMS_ENABLED','LEGIWATCH_STATE_SERVER_CAPTURE_ENABLED','LEGIWATCH_AGENDA_ALERTS_ENABLED',
   'LEGIWATCH_EDITORIAL_PREPARE_ENABLED','LEGIWATCH_STATUTE_MONITOR_ENABLED','TRACKER_ALERTS_ENABLED','LEGIWATCH_HEARING_EMAIL_ENABLED',
   'LEGIWATCH_RECORD_EMAIL_ENABLED','LEGIWATCH_RECORD_SMS_ENABLED','LEGIWATCH_EDITORIAL_SEND_ENABLED','LEGIWATCH_NEWS_MONITOR_ENABLED',
   'HEARING_TRANSCRIPTION_RECOVERY_ENABLED'],
}
SET = {'engagement-api': {'ENGAGEMENT_BACKGROUND_OWNER': 'none'}}
def aws(*a):
    return json.loads(subprocess.run(AWS + list(a) + ['--output', 'json'], check=True, capture_output=True, text=True).stdout)
out = {}
for svc in ['api-strategy', 'intel-api', 'engagement-api', 'workspace', 'onboard-api']:
    live = aws('ecs', 'describe-services', '--cluster', 'capiro-dev', '--services', f'capiro-dev-{svc}')['services'][0]['taskDefinition']
    td = aws('ecs', 'describe-task-definition', '--task-definition', live)['taskDefinition']
    for k in ('taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy', 'deregisteredAt'): td.pop(k, None)
    td['family'] = f'capiro-preview-{svc}'
    (c,) = td['containerDefinitions']
    dig = aws('ecr', 'describe-images', '--repository-name', f'capiro/preview-{svc}', '--image-ids', f'imageTag={SHA}')['imageDetails'][0]['imageDigest']
    c['image'] = f'967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/preview-{svc}@{dig}'
    c['secrets'] = [s for s in c.get('secrets', []) if s['name'] != 'DB_HOST']
    env = {e['name']: e['value'] for e in c.get('environment', [])}
    env['DB_HOST'] = CLONE; env['RELEASE_SHA'] = SHA
    for k in OFF.get(svc, []):
        if k in env: env[k] = 'false'
    env.update(SET.get(svc, {}))
    c['environment'] = [{'name': k, 'value': v} for k, v in sorted(env.items())]
    lc = c.get('logConfiguration', {}).get('options', {})
    if 'awslogs-stream-prefix' in lc: lc['awslogs-stream-prefix'] = f'preview-{svc}'
    path = f'C:/dev/fable/cutover-20261022/td-preview-{svc}.json'; json.dump(td, open(path, 'w'))
    arn = aws('ecs', 'register-task-definition', '--cli-input-json', f'file://{path}')['taskDefinition']['taskDefinitionArn']
    turned_off = [k for k in OFF.get(svc, []) if k in env]
    out[svc] = {'td': arn.split('/')[-1], 'image': dig[:19], 'dbHostIsClone': env['DB_HOST'] == CLONE, 'backgroundOff': len(turned_off) + len(SET.get(svc, {}))}
print(json.dumps(out, indent=1))
