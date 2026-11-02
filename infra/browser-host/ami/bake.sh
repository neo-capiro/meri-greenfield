#!/usr/bin/env bash
# Bakes the browser-only host AMI from the image build's result.json. Steps: render the reviewed files and the guest script
# (render.mjs, no AWS), launch ONE temporary builder (AL2023 arm64 from the public SSM parameter, c7g.large, encrypted gp3
# 30 GiB root, IMDSv2 with hop limit 1, the BrowserHostInstanceProfile, no public address, no key pair), run the guest bake
# over SSM, check its verification line, stop, image, set IMDSv2 as the image default, read the image back, terminate the
# builder and prove its volumes are gone. The builder is terminated on every exit. `--plan` prints each AWS call that would
# be made and makes none. Run only with the release owner's authorization; it creates one AMI and its snapshot.
#
# Required environment: BUILD_RESULT (the build's result.json), SUBNET_ID, SECURITY_GROUP_ID, INSTANCE_PROFILE_NAME (the
# outputs of the static host stack and the placement subnet), EVIDENCE_OUT (a new file). Optional: EBS_KMS_KEY_ID.
set -Eeuo pipefail
umask 077
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mode=run
if [[ ${1:-} == --help && $# == 1 ]]; then
  sed -n '2,10p' "${BASH_SOURCE[0]}"
  exit 0
fi
if [[ ${1:-} == --plan && $# == 1 ]]; then mode=plan; shift; fi
[[ $# == 0 ]] || exit 2
[[ -f ${BUILD_RESULT:-} && ${SUBNET_ID:-} =~ ^subnet-[0-9a-f]{8,17}$ && ${SECURITY_GROUP_ID:-} =~ ^sg-[0-9a-f]{8,17}$ ]] || exit 2
[[ ${INSTANCE_PROFILE_NAME:-} =~ ^[A-Za-z0-9+=,.@_-]{1,128}$ && -n ${EVIDENCE_OUT:-} && ! -e ${EVIDENCE_OUT:-} ]] || exit 2
[[ -z ${EBS_KMS_KEY_ID:-} || ${EBS_KMS_KEY_ID} =~ ^(arn:aws:kms:us-east-1:967807252336:key/)?[0-9a-f-]{36}$ || ${EBS_KMS_KEY_ID} =~ ^alias/[A-Za-z0-9/_-]+$ ]] || exit 2
account=967807252336
region=us-east-1
work=$(mktemp -d /tmp/meri-ami-bake.XXXXXXXX)
builder=''
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ -n $builder && $mode == run ]]; then
    aws --region "$region" --no-cli-pager ec2 terminate-instances --instance-ids "$builder" > /dev/null 2>&1 || rc=1
  fi
  rm -rf -- "$work"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# One place for every AWS call: --plan prints it and returns the placeholder, a run executes it.
call() {
  local placeholder=$1
  shift
  if [[ $mode == plan ]]; then
    printf 'PLAN aws %s\n' "$*" >&2
    printf '%s' "$placeholder"
  else
    aws --region "$region" --no-cli-pager "$@"
  fi
}
step() { printf 'STEP %s\n' "$*" >&2; }

step 1 render the reviewed files and the guest script from the build result
node "$here/render.mjs" render --result "$BUILD_RESULT" --out "$work/render" > "$work/render.json"
name=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).amiName)" "$work/render.json")
[[ $name =~ ^meri-browser-host-[0-9a-f]{12}-[0-9a-f]{12}$ ]] || exit 1

step 2 refuse unless the caller is the account owner and the image does not exist
caller=$(call "arn:aws:iam::$account:user/PLAN" sts get-caller-identity --query Arn --output text)
[[ $caller == arn:aws:iam::$account:* ]] || exit 1
existing=$(call 0 ec2 describe-images --owners self --filters "Name=name,Values=$name" --query 'length(Images)' --output text)
[[ $existing == 0 ]] || { echo "image $name already exists; images are immutable" >&2; exit 1; }

step 3 resolve the AL2023 arm64 base image from the public SSM parameter and check it
base=$(call ami-0plan ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query Parameter.Value --output text)
described_base=$(call 'arm64 amazon ebs /dev/xvda' ec2 describe-images --image-ids "$base" --query 'Images[0].[Architecture,ImageOwnerAlias,RootDeviceType,RootDeviceName]' --output text)
[[ $described_base == 'arm64 amazon ebs /dev/xvda' ]] || { echo "unexpected base image: $described_base" >&2; exit 1; }
ebs='{"Encrypted":true,"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}'
if [[ -n ${EBS_KMS_KEY_ID:-} ]]; then ebs=${ebs%\}}",\"KmsKeyId\":\"$EBS_KMS_KEY_ID\"}"; fi
token="meri-bake-$(printf '%s' "$name$base" | sha256sum | cut -c1-24)"
tags="[{Key=Project,Value=meri-greenfield},{Key=MeriBake,Value=$name},{Key=Name,Value=$name-builder}]"

step 4 launch the temporary builder
builder=$(call i-0plan ec2 run-instances --client-token "$token" --image-id "$base" --instance-type c7g.large --count 1 \
  --network-interfaces "DeviceIndex=0,SubnetId=$SUBNET_ID,Groups=$SECURITY_GROUP_ID,AssociatePublicIpAddress=false,DeleteOnTermination=true" \
  --iam-instance-profile "Name=$INSTANCE_PROFILE_NAME" --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":$ebs}]" \
  --metadata-options HttpTokens=required,HttpPutResponseHopLimit=1,HttpEndpoint=enabled --instance-initiated-shutdown-behavior stop \
  --tag-specifications "ResourceType=instance,Tags=$tags" "ResourceType=volume,Tags=$tags" --query 'Instances[0].InstanceId' --output text)
[[ $builder =~ ^i-[0-9a-f]{8,17}$ || $mode == plan ]] || exit 1
call '' ec2 wait instance-running --instance-ids "$builder" > /dev/null

step 5 wait for the builder to register with SSM
online=''
for ((attempt = 0; attempt < 60; attempt++)); do
  online=$(call Online ssm describe-instance-information --filters "Key=InstanceIds,Values=$builder" --query 'InstanceInformationList[0].PingStatus' --output text)
  [[ $online == Online ]] && break
  sleep 10
done
[[ $online == Online ]] || { echo "builder never registered with SSM" >&2; exit 1; }

step 6 run the guest bake
base64 -w0 "$work/render/guest-bake.sh" > "$work/guest.b64"
printf '{"commands":["echo %s | base64 -d > /root/meri-bake.sh","bash /root/meri-bake.sh"]}\n' "$(cat "$work/guest.b64")" > "$work/params.json"
command_id=$(call cmd-plan ssm send-command --instance-ids "$builder" --document-name AWS-RunShellScript --parameters "file://$work/params.json" \
  --timeout-seconds 1800 --comment "meri browser host bake $name" --query Command.CommandId --output text)
status=''
for ((attempt = 0; attempt < 240; attempt++)); do
  status=$(call Success ssm get-command-invocation --command-id "$command_id" --instance-id "$builder" --query Status --output text 2>/dev/null || true)
  case $status in Pending | InProgress | Delayed | '') sleep 10 ;; *) break ;; esac
done
[[ $status == Success ]] || { echo "guest bake ended with status ${status:-unknown}" >&2; exit 1; }
call '{"marker":"PLAN"}' ssm get-command-invocation --command-id "$command_id" --instance-id "$builder" --query StandardOutputContent --output text | tail -n 1 > "$work/report.json"
if [[ $mode == run ]]; then node "$here/render.mjs" verify-guest --input "$work/render/input.json" --report "$work/report.json" > /dev/null; fi

step 7 stop the builder and create the image
call '' ec2 stop-instances --instance-ids "$builder" > /dev/null
call '' ec2 wait instance-stopped --instance-ids "$builder"
image=$(call ami-0plan ec2 create-image --instance-id "$builder" --name "$name" --description "Meri browser-only host: AL2023 arm64, docker, node, /opt/meri closure, reviewed profile, identity and host units" \
  --tag-specifications "ResourceType=image,Tags=[{Key=Project,Value=meri-greenfield},{Key=MeriBake,Value=$name}]" "ResourceType=snapshot,Tags=[{Key=Project,Value=meri-greenfield},{Key=MeriBake,Value=$name}]" \
  --query ImageId --output text)
state=''
for ((attempt = 0; attempt < 240; attempt++)); do
  state=$(call available ec2 describe-images --image-ids "$image" --query 'Images[0].State' --output text)
  [[ $state == pending ]] && { sleep 15; continue; }
  break
done
[[ $state == available ]] || { echo "image state $state" >&2; exit 1; }

step 8 make IMDSv2 the image default and read the image back
call '' ec2 modify-image-attribute --image-id "$image" --imds-support v2.0
call '{"Images":[]}' ec2 describe-images --image-ids "$image" --output json > "$work/described.json"
if [[ $mode == run ]]; then
  node "$here/render.mjs" verify-image --described "$work/described.json" > /dev/null
  node "$here/render.mjs" evidence --input "$work/render/input.json" --report "$work/report.json" --described "$work/described.json" --base-ami "$base" --builder "$builder" --out "$EVIDENCE_OUT"
fi

step 9 terminate the builder and prove no volume of this bake remains
call '' ec2 terminate-instances --instance-ids "$builder" > /dev/null
call '' ec2 wait instance-terminated --instance-ids "$builder"
builder=''
remaining=$(call 0 ec2 describe-volumes --filters "Name=tag:MeriBake,Values=$name" --query 'length(Volumes)' --output text)
[[ $remaining == 0 ]] || { echo "builder volumes remain: $remaining" >&2; exit 1; }
step done
